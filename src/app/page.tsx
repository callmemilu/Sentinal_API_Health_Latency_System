import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import LatencyChart from '@/components/LatencyChart';
import { Activity, CheckCircle2, Clock, Globe, AlertTriangle } from 'lucide-react';
import AddMonitorModal from '@/components/AddMonitorModal';

export const revalidate = 0;

interface PingLog {
  id: string;
  monitor_id: string;
  status_code: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
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
}

export default async function DashboardPage() {
  const user = await currentUser();
  const userId = user?.id;

  // 1. Fetch user's monitors
  const { data: rawMonitors } = await supabaseAdmin
    .from('monitors')
    .select('*')
    .eq('user_id', userId || '')
    .order('created_at', { ascending: false });

  const monitors: Monitor[] = rawMonitors || [];
  const monitorIds = monitors.map((m) => m.id);

  // 2. Fetch recent logs for those monitors
  let pingLogs: PingLog[] = [];
  if (monitorIds.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from('ping_logs')
      .select('*')
      .in('monitor_id', monitorIds)
      .order('created_at', { ascending: true })
      .limit(100);
    pingLogs = (logs as PingLog[]) || [];
  }

  // 3. Compute top overview stats
  const totalMonitors = monitors.length;
  const operationalCount = monitors.filter((m) => m.status === 'Operational').length;
  const uptimePercent = totalMonitors > 0 ? ((operationalCount / totalMonitors) * 100).toFixed(1) : '100.0';

  const validLatencies = pingLogs
    .map((l) => l.latency_ms)
    .filter((lat): lat is number => lat !== null);

  const avgLatency = validLatencies.length > 0
    ? Math.round(validLatencies.reduce((acc, curr) => acc + curr, 0) / validLatencies.length)
    : 0;

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto space-y-8">
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
            {user?.emailAddresses[0]?.emailAddress}
          </span>
          <UserButton />
        </div>
      </header>

      {/* Top Metric Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Active Monitors</p>
            <p className="text-3xl font-bold text-white mt-1">{totalMonitors}</p>
          </div>
          <Globe className="h-8 w-8 text-blue-400 opacity-80" />
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Global Health</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">{uptimePercent}%</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-80" />
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Avg Latency</p>
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
          <AddMonitorModal defaultEmail={user?.emailAddresses[0]?.emailAddress} />
        </div>

        {monitors.length > 0 ? (
          <div className="space-y-4">
            {monitors.map((m) => {
              const monitorLogs = pingLogs.filter((l) => l.monitor_id === m.id);
              const chartData = monitorLogs.map((l) => ({
                time: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                latency: l.latency_ms || 0,
                status: l.status_code || 0,
              }));

              const isUp = m.status === 'Operational';

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white text-base">{m.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isUp
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isUp ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {m.status}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-1">{m.url}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                      <span>Method: <strong className="text-slate-200">{m.method || 'GET'}</strong></span>
                      <span>Timeout: <strong className="text-slate-200">{m.timeout_ms || 5000}ms</strong></span>
                    </div>
                  </div>

                  {/* Chart area */}
                  <div className="border-t border-slate-800/60 pt-3">
                    <p className="text-xs text-slate-400 font-medium mb-1">Recent Response Latency</p>
                    <LatencyChart data={chartData} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400 text-sm">
            No monitors found for this user ID. Use the button above to add your first endpoint.
          </div>
        )}
      </section>
    </div>
  );
}