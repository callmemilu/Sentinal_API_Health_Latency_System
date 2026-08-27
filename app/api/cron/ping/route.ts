import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pingEndpoint } from '@/lib/pinger';

export const dynamic = 'force-dynamic';

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  interval_minutes: number;
  timeout_ms: number;
  status: string;
  created_at: string;
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
    const { data: monitors, error: fetchError } = await supabaseAdmin
      .from('monitors')
      .select('*');

    if (fetchError) {
      console.error('Error fetching monitors:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch monitors' }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ message: 'No monitors found to probe' }, { status: 200 });
    }

    const pingPromises = (monitors as Monitor[]).map(async (monitor) => {
      const result = await pingEndpoint(monitor.url, monitor.method, monitor.timeout_ms);
      return {
        monitor_id: monitor.id,
        status_code: result.statusCode,
        latency_ms: result.latencyMs,
        is_up: result.isUp,
        error_message: result.errorMessage,
      };
    });

    const settledResults = await Promise.allSettled(pingPromises);

    const logsToInsert: PingLogRow[] = settledResults
      .filter((res): res is PromiseFulfilledResult<PingLogRow> => res.status === 'fulfilled')
      .map((res) => res.value);

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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in cron worker:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}