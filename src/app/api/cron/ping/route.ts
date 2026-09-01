import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pingEndpoint } from '@/lib/pinger';
import { sendDiscordAlert, sendEmailAlert, AlertPayload } from '@/lib/alert-dispatchers';

export const dynamic = 'force-dynamic';

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  interval_minutes: number;
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
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Query monitors directly
    const { data: monitorsData, error: monitorsError } = await supabaseAdmin
      .from('monitors')
      .select('*');

    if (monitorsError) {
      console.error('Error fetching monitors:', monitorsError);
      return NextResponse.json({ error: 'Failed to fetch monitors' }, { status: 500 });
    }

    const monitors = monitorsData as Monitor[];

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ message: 'No monitors found to probe' }, { status: 200 });
    }

    // 2. Fetch alert settings in parallel
    const { data: alertSettingsData } = await supabaseAdmin
      .from('alert_settings')
      .select('*');

    const alertSettingsMap = new Map<string, AlertSetting>();
    if (alertSettingsData) {
      (alertSettingsData as AlertSetting[]).forEach((setting) => {
        alertSettingsMap.set(setting.monitor_id, setting);
      });
    }

    const currentTimestamp = new Date().toISOString();

    // 3. Ping all monitors concurrently
    const pingPromises = monitors.map(async (monitor) => {
      const probe = await pingEndpoint(monitor.url, monitor.method, monitor.timeout_ms);
      
      const newStatus = probe.isUp ? 'Operational' : 'Down';
      const stateTransitioned = monitor.status !== newStatus;

      // Handle alerts on transition
      if (stateTransitioned) {
        await supabaseAdmin
          .from('monitors')
          .update({ status: newStatus })
          .eq('id', monitor.id);

        const alertSetting = alertSettingsMap.get(monitor.id);

        if (alertSetting) {
          const alertPayload: AlertPayload = {
            monitorName: monitor.name,
            url: monitor.url,
            status: probe.isUp ? 'RECOVERED' : 'DOWN',
            statusCode: probe.statusCode,
            latencyMs: probe.latencyMs,
            errorMessage: probe.errorMessage,
            timestamp: currentTimestamp,
          };

          if (alertSetting.discord_webhook_url) {
            await sendDiscordAlert(alertSetting.discord_webhook_url, alertPayload);
          }
          if (alertSetting.notify_email) {
            await sendEmailAlert(alertSetting.notify_email, alertPayload);
          }
        }
      }

      return {
        monitor_id: monitor.id,
        status_code: probe.statusCode,
        latency_ms: probe.latencyMs,
        is_up: probe.isUp,
        error_message: probe.errorMessage,
      };
    });

    const settledResults = await Promise.allSettled(pingPromises);

    const logsToInsert: PingLogRow[] = settledResults
      .filter((res): res is PromiseFulfilledResult<PingLogRow> => res.status === 'fulfilled')
      .map((res) => res.value);

    // 4. Batch insert into ping_logs
    if (logsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('ping_logs')
        .insert(logsToInsert);

      if (insertError) {
        console.error('Error inserting ping logs:', insertError);
        return NextResponse.json({ error: 'Failed to record ping logs' }, { status: 500 });
      }
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