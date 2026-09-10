import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import InteractiveMonitorItem from '@/components/InteractiveMonitorItem';
import NewMonitorModal from '@/components/NewMonitorModal';
import AutoRefresh from '@/components/AutoRefresh';
import {
  Activity,
  CheckCircle2,
  Clock,
  Globe,
  ShieldAlert,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

interface PingLog {
  id: string;
  monitor_id: string;
  is_up: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface AlertSetting {
  discord_webhook_url?: string | null;
  notify_email?: string | null;
  consecutive_failures_threshold?: number;
}

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  interval_seconds: number;
  timeout_ms: number;
  status: 'Operational' | 'Down' | 'Degraded';
  created_at: string;
  alert_settings?: AlertSetting | AlertSetting[] | null;
}

export default async function DashboardPage() {
  const user = await currentUser();
  const userId = user?.id;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  // 1. Fetch monitors with joined alert_settings
  const query = supabaseAdmin
    .from('monitors')
    .select('*, alert_settings(*)')
    .order('created_at', { ascending: false });

  const { data: rawMonitors } = userId
    ? await query.or(`user_id.eq.${userId},user_id.is.null`)
    : await query;

  const monitors: Monitor[] = (rawMonitors as Monitor[]) || [];
  const monitorIds = monitors.map((m) => m.id);

  // 2. Fetch recent telemetry logs (latest 100 entries, chronologically ordered)
  let pingLogs: PingLog[] = [];
  if (monitorIds.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from('ping_logs')
      .select('*')
      .in('monitor_id', monitorIds)
      .order('created_at', { ascending: false })
      .limit(100);

    pingLogs = ((logs as PingLog[]) || []).reverse();
  }

  // 3. Compute overview statistics
  const totalMonitors = monitors.length;
  const operationalCount = monitors.filter((m) => m.status === 'Operational').length;
  const downCount = totalMonitors - operationalCount;
  const uptimePercent =
    totalMonitors > 0 ? ((operationalCount / totalMonitors) * 100).toFixed(1) : '100.0';

  const validLatencies = pingLogs
    .map((l) => l.latency_ms)
    .filter((lat): lat is number => lat !== null);

  const avgLatency =
    validLatencies.length > 0
      ? Math.round(validLatencies.reduce((acc, curr) => acc + curr, 0) / validLatencies.length)
      : 0;

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto space-y-8">
      {/* Background poller: refreshes view every 30s when tab is active */}
      <AutoRefresh intervalMs={30000} />

      {/* Header Bar */}
      <header className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Sentinel</h1>
          </div>
          <p className="text-sm text-slate-400">Synthetic API health and latency monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">
            {userEmail}
          </span>
          <UserButton />
        </div>
      </header>

      {/* Top Metric Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Active Monitors
            </p>
            <p className="text-3xl font-bold text-white mt-1">{totalMonitors}</p>
          </div>
          <Globe className="h-8 w-8 text-blue-400 opacity-80" />
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Global Health
            </p>
            <p
              className={`text-3xl font-bold mt-1 ${
                downCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {uptimePercent}%
            </p>
            {downCount > 0 && (
              <p className="text-[11px] text-rose-400 mt-0.5">{downCount} endpoint(s) failing</p>
            )}
          </div>
          {downCount > 0 ? (
            <ShieldAlert className="h-8 w-8 text-rose-400 opacity-80" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-80" />
          )}
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Avg Latency
            </p>
            <p className="text-3xl font-bold text-white mt-1">{avgLatency} ms</p>
          </div>
          <Clock className="h-8 w-8 text-indigo-400 opacity-80" />
        </div>
      </section>

      {/* Monitors List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Monitored Endpoints</h2>
            <p className="text-xs text-slate-500 font-mono">Auto-refreshed via Supabase</p>
          </div>
          <NewMonitorModal userId={userId} defaultEmail={userEmail} />
        </div>

        {monitors.length > 0 ? (
          <div className="space-y-4">
            {monitors.map((m) => {
              const monitorLogs = pingLogs.filter((l) => l.monitor_id === m.id);
              return (
                <InteractiveMonitorItem
                  key={m.id}
                  monitor={m}
                  monitorLogs={monitorLogs}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400 text-sm">
            No monitors found. Use the button above to add your first endpoint.
          </div>
        )}
      </section>
    </div>
  );
}