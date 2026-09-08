import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pingEndpoint } from '@/lib/pinger';
import { sendDiscordAlert, sendEmailAlert, AlertPayload } from '@/lib/alert-dispatchers';

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

    // 3. Ping all monitors concurrently
    const pingPromises = monitors.map(async (monitor) => {
      const probe = await pingEndpoint(monitor);

      return {
        monitor,
        probe,
        log: {
          monitor_id: monitor.id,
          status_code: probe.statusCode,
          latency_ms: probe.latencyMs,
          is_up: probe.isUp,
          error_message: probe.errorMessage,
        } as PingLogRow,
      };
    });

    const settledResults = await Promise.allSettled(pingPromises);

    const logsToInsert: PingLogRow[] = [];
    const monitorUpdates: PromiseLike<unknown>[] = [];
    const alertDispatches: Promise<unknown>[] = [];

    // 4. Process state transitions & failure thresholds
    for (const res of settledResults) {
      if (res.status !== 'fulfilled') continue;

      const { monitor, probe, log } = res.value;
      logsToInsert.push(log);

      const isCurrentlyUp = monitor.status === 'Operational';
      const alertSetting = alertSettingsMap.get(monitor.id);
      const threshold = alertSetting?.consecutive_failures_threshold || 1;

      // Scenario A: Recovered (Down -> Operational)
      if (!isCurrentlyUp && probe.isUp) {
        monitorUpdates.push(
          supabaseAdmin.from('monitors').update({ status: 'Operational' }).eq('id', monitor.id)
        );

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

      // Scenario B: Failing (Operational -> Down)
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
          monitorUpdates.push(
            supabaseAdmin.from('monitors').update({ status: 'Down' }).eq('id', monitor.id)
          );

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
    }

    // 5. Batch write logs and status updates
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