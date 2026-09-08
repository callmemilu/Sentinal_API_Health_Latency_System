"use client";

import React, { useState } from "react";
import LatencyChart from "@/components/LatencyChart";
import StatusPillStream, { PingLog } from "@/components/StatusPillStream";
import IncidentAutopsyDrawer from "@/components/IncidentAutopsyDrawer";
import CardActions from "@/components/CardActions";
import { CheckCircle2, AlertTriangle, ServerCrash } from "lucide-react";

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

  const isUp = m.status === "Operational";
  const latestLog = monitorLogs[monitorLogs.length - 1];

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

  return (
    <>
      <div className="w-full [perspective:1200px]">
        <div
          className={`rounded-xl border p-5 space-y-4 transition-all duration-300 ${
            isUp
              ? "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              : "border-rose-800/80 bg-gradient-to-b from-rose-950/30 to-slate-900/60 shadow-lg shadow-rose-950/20"
          }`}
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-white text-base">{m.name}</h3>
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
              <CardActions monitorId={m.id} />
            </div>
          </div>

          {/* Outage Banner if Down */}
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
        onClose={() => setSelectedLog(null)}
      />
    </>
  );
}