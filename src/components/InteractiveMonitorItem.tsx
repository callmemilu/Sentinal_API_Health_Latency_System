"use client";

import React, { useState } from "react";
import LatencyChart from "@/components/LatencyChart";
import StatusPillStream, { PingLog } from "@/components/StatusPillStream";
import IncidentAutopsyDrawer from "@/components/IncidentAutopsyDrawer";
import CardActions from "@/components/CardActions";
import EditMonitorModal from "@/components/EditMonitorModal";
import { CheckCircle2, AlertTriangle, ServerCrash, Pencil, Lock } from "lucide-react";

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
  status: "Operational" | "Down" | "Degraded";
  created_at: string;
  headers?: Record<string, string> | string | null;
  ssl_days_remaining?: number | null;
  ssl_issuer?: string | null;
  alert_settings?: AlertSetting | AlertSetting[] | null;
}

interface InteractiveMonitorItemProps {
  monitor: Monitor;
  monitorLogs: PingLog[];
}

export default function InteractiveMonitorItem({
  monitor: m,
  monitorLogs,
}: InteractiveMonitorItemProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<PingLog | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isUp = m.status === "Operational";
  const latestLog = monitorLogs[monitorLogs.length - 1];

  // Calculate trailing consecutive failure count
  const reversedLogs = [...monitorLogs].reverse();
  const firstSuccessfulIndex = reversedLogs.findIndex((log) => log.is_up);
  const consecutiveFailures =
    firstSuccessfulIndex === -1
      ? monitorLogs.length
      : Math.max(1, firstSuccessfulIndex);

  const chartData = monitorLogs.map((l) => ({
    id: l.id,
    time: new Date(l.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    latency: l.latency_ms || 0,
    status: l.status_code || 0,
    isUp: l.is_up,
  }));

  // Normalize alert_settings whether returned as object or 1-element array
  const resolvedAlertSettings = Array.isArray(m.alert_settings)
    ? m.alert_settings[0] || null
    : m.alert_settings || null;

  // Type-safe SSL status evaluations
  const sslDays = m.ssl_days_remaining;
  const isSslChecking = sslDays === null || sslDays === undefined;
  const isSslExpired = typeof sslDays === "number" && sslDays <= 0;
  const isSslExpiringSoon = typeof sslDays === "number" && sslDays > 0 && sslDays <= 14;

  const sslBadgeClass = isSslChecking
    ? "border-slate-800 bg-slate-800/50 text-slate-400"
    : isSslExpired
    ? "border-rose-800/60 bg-rose-950/40 text-rose-300"
    : isSslExpiringSoon
    ? "border-amber-700/60 bg-amber-950/40 text-amber-300"
    : "border-slate-800 bg-slate-800/50 text-slate-300";

  return (
    <>
      <div className="w-full [perspective:1200px]">
        <div
          className={`rounded-xl border p-5 space-y-4 transition-all duration-300 ${
            isUp
              ? "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              : "border-rose-900/60 bg-gradient-to-b from-rose-950/40 to-slate-900/80 shadow-lg shadow-rose-950/30"
          }`}
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-semibold text-white text-base">{m.name}</h3>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isUp
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                  }`}
                >
                  {isUp ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {m.status}
                </span>

                {/* SSL Certificate Badge */}
                {m.url.startsWith("https://") && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${sslBadgeClass}`}
                    title={m.ssl_issuer ? `Issuer: ${m.ssl_issuer}` : undefined}
                  >
                    <Lock className="h-2.5 w-2.5 text-slate-400" />
                    {isSslChecking
                      ? "SSL: Checking..."
                      : isSslExpired
                      ? "SSL Expired"
                      : `${sslDays}d SSL`}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">{m.url}</p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span>
                Method: <strong className="text-slate-200">{m.method || "GET"}</strong>
              </span>
              <span>
                Timeout: <strong className="text-slate-200">{m.timeout_ms || 5000}ms</strong>
              </span>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer"
                  title="Edit Monitor"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <CardActions monitorId={m.id} />
              </div>
            </div>
          </div>

          {/* Outage Banner */}
          {!isUp && (
            <div className="p-3.5 rounded-lg border border-rose-800/50 bg-rose-950/40 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 font-semibold">
                  <ServerCrash className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>
                    {latestLog?.status_code
                      ? `HTTP ${latestLog.status_code} Error`
                      : "Network / Connection Failure"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Logged:{" "}
                  <strong className="text-rose-300">
                    {latestLog?.created_at
                      ? new Date(latestLog.created_at).toLocaleTimeString()
                      : "Just now"}
                  </strong>
                </span>
              </div>
              <p className="text-rose-200/90 text-xs pl-6">
                {latestLog?.error_message ||
                  "Target endpoint did not return an operational HTTP status code."}
              </p>
            </div>
          )}

          {/* Status Pill Stream */}
          <div className="pt-1">
            <StatusPillStream
              logs={monitorLogs}
              maxPills={30}
              activeIndex={activeIndex}
              onHoverIndex={setActiveIndex}
              onSelectLog={(log: PingLog) => setSelectedLog(log)}
            />
          </div>

          {/* Latency Chart */}
          <div className="border-t border-slate-800/60 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 font-medium">Recent Response Latency</p>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-slate-400">
                  Samples: <strong className="text-slate-200">{monitorLogs.length}</strong>
                </span>
                <span className="text-slate-400">
                  Latest:{" "}
                  <strong className={isUp ? "text-emerald-400" : "text-rose-400 font-semibold"}>
                    {latestLog?.latency_ms ?? 0} ms
                  </strong>
                </span>
              </div>
            </div>
            <LatencyChart
              data={chartData}
              activeIndex={activeIndex}
              onHoverIndex={setActiveIndex}
              isUp={isUp}
            />
          </div>
        </div>
      </div>

      {/* Forensic Drawer */}
      <IncidentAutopsyDrawer
        log={selectedLog}
        monitorName={m.name}
        monitorUrl={m.url}
        monitorMethod={m.method}
        consecutiveFailures={consecutiveFailures}
        siblingOutages={[]}
        onClose={() => setSelectedLog(null)}
      />

      {/* Edit Modal */}
      <EditMonitorModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        monitor={{
          ...m,
          alert_settings: resolvedAlertSettings,
        }}
      />
    </>
  );
}