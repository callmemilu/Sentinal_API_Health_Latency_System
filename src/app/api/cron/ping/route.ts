import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pingEndpoint } from '@/lib/pinger';
import { sendDiscordAlert, sendEmailAlert, AlertPayload } from '@/lib/alert-dispatchers';
import { checkSslCertificate } from '@/lib/ssl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  timeout_ms: number;
  status: 'Operational' | 'Down';
  created_at: string;
  headers?: Record<string, string> | string | null;
  ssl_days_remaining?: number | null;
  ssl_issuer?: string | null;
}

interface AlertSetting {
  monitor_id: string;
  discord_webhook_url: string | null;
  notify_email: string | null;
  consecutive_failures_threshold: number;
}

interface PingLogRow {
  monitor_id: string;
  status_code: number | null;
  latency_ms: number;
  is_up: boolean;
  error_message: string | null;
  ssl_days_remaining?: number | null;
}

export async function GET(request: NextRequest) {
  // 1. Secret token verification
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const currentTimestamp = new Date().toISOString();

    // 2. Fetch monitors and alert settings in parallel
    const [monitorsResult, alertSettingsResult] = await Promise.all([
      supabaseAdmin.from('monitors').select('*'),
      supabaseAdmin.from('alert_settings').select('*'),
    ]);

    if (monitorsResult.error) {
      console.error('Error fetching monitors:', monitorsResult.error);
      return NextResponse.json({ error: 'Failed to fetch monitors' }, { status: 500 });
    }

    const monitors = (monitorsResult.data as Monitor[]) || [];
    if (monitors.length === 0) {
      return NextResponse.json({ message: 'No monitors found to probe' }, { status: 200 });
    }

    const alertSettingsMap = new Map<string, AlertSetting>();
    if (alertSettingsResult.data) {
      (alertSettingsResult.data as AlertSetting[]).forEach((setting) => {
        alertSettingsMap.set(setting.monitor_id, setting);
      });
    }

    // 3. Ping all monitors and inspect SSL certificates concurrently
    const pingPromises = monitors.map(async (monitor) => {
      const [probe, sslResult] = await Promise.all([
        pingEndpoint(monitor),
        checkSslCertificate(monitor.url, 4000),
      ]);

      return {
        monitor,
        probe,
        sslResult,
        log: {
          monitor_id: monitor.id,
          status_code: probe.statusCode,
          latency_ms: probe.latencyMs,
          is_up: probe.isUp,
          error_message: probe.errorMessage,
          ssl_days_remaining: sslResult.daysRemaining,
        } as PingLogRow,
      };
    });

    const settledResults = await Promise.allSettled(pingPromises);

    const logsToInsert: PingLogRow[] = [];
    const monitorUpdates: PromiseLike<unknown>[] = [];
    const alertDispatches: Promise<unknown>[] = [];

    // 4. Process state transitions, failure thresholds & SSL metadata
    for (const res of settledResults) {
      if (res.status !== 'fulfilled') continue;

      const { monitor, probe, sslResult, log } = res.value;
      logsToInsert.push(log);

      const isCurrentlyUp = monitor.status === 'Operational';
      const alertSetting = alertSettingsMap.get(monitor.id);
      const threshold = alertSetting?.consecutive_failures_threshold || 1;

      let targetStatus: 'Operational' | 'Down' = monitor.status;

      // Scenario A: Recovered (Down -> Operational)
      if (!isCurrentlyUp && probe.isUp) {
        targetStatus = 'Operational';

        if (alertSetting) {
          const alertPayload: AlertPayload = {
            monitorName: monitor.name,
            url: monitor.url,
            status: 'RECOVERED',
            statusCode: probe.statusCode,
            latencyMs: probe.latencyMs,
            errorMessage: null,
            timestamp: currentTimestamp,
          };

          if (alertSetting.discord_webhook_url) {
            alertDispatches.push(
              sendDiscordAlert(alertSetting.discord_webhook_url, alertPayload).catch(console.error)
            );
          }
          if (alertSetting.notify_email) {
            alertDispatches.push(
              sendEmailAlert(alertSetting.notify_email, alertPayload).catch(console.error)
            );
          }
        }
      }

      // Scenario B: Failing (Operational -> Down with Flap Suppression)
      if (isCurrentlyUp && !probe.isUp) {
        let shouldTriggerAlert = threshold <= 1;

        if (threshold > 1) {
          const { data: pastLogs } = await supabaseAdmin
            .from('ping_logs')
            .select('is_up')
            .eq('monitor_id', monitor.id)
            .order('created_at', { ascending: false })
            .limit(threshold - 1);

          const priorFailures = pastLogs?.filter((l) => !l.is_up).length || 0;
          if (priorFailures + 1 >= threshold) {
            shouldTriggerAlert = true;
          }
        }

        if (shouldTriggerAlert) {
          targetStatus = 'Down';

          if (alertSetting) {
            const alertPayload: AlertPayload = {
              monitorName: monitor.name,
              url: monitor.url,
              status: 'DOWN',
              statusCode: probe.statusCode,
              latencyMs: probe.latencyMs,
              errorMessage: probe.errorMessage,
              timestamp: currentTimestamp,
            };

            if (alertSetting.discord_webhook_url) {
              alertDispatches.push(
                sendDiscordAlert(alertSetting.discord_webhook_url, alertPayload).catch(console.error)
              );
            }
            if (alertSetting.notify_email) {
              alertDispatches.push(
                sendEmailAlert(alertSetting.notify_email, alertPayload).catch(console.error)
              );
            }
          }
        }
      }

      // Persist status updates along with fresh SSL audit metadata
      monitorUpdates.push(
        supabaseAdmin
          .from('monitors')
          .update({
            status: targetStatus,
            ssl_days_remaining: sslResult.daysRemaining,
            ssl_issuer: sslResult.issuer,
          })
          .eq('id', monitor.id)
      );
    }

    // 5. Batch write logs and apply monitor updates
    if (logsToInsert.length > 0) {
      await supabaseAdmin.from('ping_logs').insert(logsToInsert);
    }
    if (monitorUpdates.length > 0) {
      await Promise.all(monitorUpdates);
    }
    if (alertDispatches.length > 0) {
      await Promise.all(alertDispatches);
    }

    return NextResponse.json({
      success: true,
      processed: logsToInsert.length,
      timestamp: currentTimestamp,
    });
  } catch (error) {
    console.error('Unexpected error in cron worker:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}