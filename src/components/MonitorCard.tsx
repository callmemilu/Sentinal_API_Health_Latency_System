"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LatencyChart from "@/components/LatencyChart";
import StatusPillStream from "@/components/StatusPillStream";
import {
  CheckCircle2,
  AlertTriangle,
  ServerCrash,
  Play,
  Trash2,
  Loader2,
} from "lucide-react";

interface PingLog {
  id: string;
  monitor_id: string;
  is_up: boolean;
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
  status: "Operational" | "Down" | "Degraded";
  created_at: string;
}

interface MonitorCardProps {
  monitor: Monitor;
  monitorLogs: PingLog[];
}

export default function MonitorCard({ monitor: m, monitorLogs }: MonitorCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isUp = m.status === "Operational";

  const [isFlipped] = useState(!isUp);
  const latestLog = monitorLogs[monitorLogs.length - 1];

  const chartData = monitorLogs.map((l) => ({
    time: new Date(l.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    latency: l.latency_ms || 0,
    status: l.status_code || 0,
  }));

  const handleTriggerPing = async () => {
    if (isPending) return;

    try {
      await fetch(`/api/monitors/${m.id}/ping`, { method: "POST" });
    } catch {
      // Ignore network errors for optimistic UI
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const handleDelete = async () => {
    if (confirm("Delete this monitor?")) {
      await fetch(`/api/monitors/${m.id}`, { method: "DELETE" });
      router.refresh();
    }
  };

  return (
    <div className="w-full relative min-h-[320px]" style={{ perspective: "1400px" }}>
      {/* 3D Rotating Container */}
      <div
        className="w-full h-full transition-transform duration-700 ease-in-out"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateX(180deg)" : "rotateX(0deg)",
        }}
      >
        {/* ================= FRONT SIDE (OPERATIONAL / GREEN) ================= */}
        <div
          className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4 shadow-md"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-white text-base">{m.name}</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Operational
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTriggerPing}
                  disabled={isPending}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
                  title="Run probe"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                  title="Delete monitor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Status Pill Stream */}
          <div className="pt-1">
            <StatusPillStream logs={monitorLogs} maxPills={30} />
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
                  <strong className="text-emerald-400">
                    {latestLog?.latency_ms ?? 0} ms
                  </strong>
                </span>
              </div>
            </div>
            <LatencyChart key={`chart-${m.id}-${monitorLogs.length}`} data={chartData} />
          </div>
        </div>

        {/* ================= BACK SIDE (DOWN / RED DIAGNOSTICS) ================= */}
        <div
          className="absolute inset-0 w-full h-full rounded-xl border border-rose-800/80 bg-gradient-to-b from-rose-950/60 via-slate-900/95 to-slate-900 p-5 flex flex-col justify-between shadow-2xl shadow-rose-950/40"
          style={{
            transform: "rotateX(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-rose-900/40">
              <div className="flex items-center gap-3">
                <ServerCrash className="h-5 w-5 text-rose-400 animate-pulse" />
                <h3 className="font-semibold text-white text-base">{m.name}</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Service Down
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span>
                  Method: <strong className="text-slate-200">{m.method || "GET"}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleTriggerPing}
                    disabled={isPending}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                    title="Retry probe"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                    title="Delete monitor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Diagnostic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-900/50">
                <p className="text-[10px] uppercase font-mono tracking-wider text-rose-400">
                  HTTP Status
                </p>
                <p className="text-lg font-bold font-mono text-white mt-0.5">
                  {latestLog?.status_code ? `HTTP ${latestLog.status_code}` : "NO RESPONSE"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {latestLog?.status_code === 500
                    ? "Internal Server Error"
                    : latestLog?.status_code === 502
                    ? "Bad Gateway"
                    : latestLog?.status_code === 503
                    ? "Service Unavailable"
                    : latestLog?.status_code === 404
                    ? "Endpoint Not Found"
                    : "Network Timeout / Abort"}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-900/50 sm:col-span-2">
                <p className="text-[10px] uppercase font-mono tracking-wider text-rose-400">
                  Failure Reason & Details
                </p>
                <p className="text-xs font-mono text-rose-200 mt-1 break-words">
                  {latestLog?.error_message || "fetch failed"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Duration before termination:{" "}
                  <span className="font-mono text-rose-300">{latestLog?.latency_ms ?? 0}ms</span>
                </p>
              </div>
            </div>

            {/* Status Pill Stream on Down view */}
            <div className="pt-3">
              <StatusPillStream logs={monitorLogs} maxPills={30} />
            </div>
          </div>

          <div className="pt-3 border-t border-rose-900/40 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Target: <strong className="text-slate-300">{m.url}</strong></span>
            <span>
              Timestamp:{" "}
              <strong className="text-rose-300">
                {latestLog?.created_at
                  ? new Date(latestLog.created_at).toLocaleTimeString()
                  : "Just now"}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}