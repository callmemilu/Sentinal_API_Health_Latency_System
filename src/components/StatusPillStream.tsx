"use client";

import React, { useState } from "react";

export interface PingLog {
  id: string;
  monitor_id?: string;
  is_up: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error_message?: string | null;
  created_at: string;
}

interface StatusPillStreamProps {
  logs?: PingLog[];
  maxPills?: number;
  activeIndex?: number | null;
  onHoverIndex?: (index: number | null) => void;
  onSelectLog?: (log: PingLog) => void;
}

export default function StatusPillStream({
  logs = [],
  maxPills = 30,
  activeIndex,
  onHoverIndex,
  onSelectLog,
}: StatusPillStreamProps) {
  const safeLogs = Array.isArray(logs) ? logs : [];

  const sorted = [...safeLogs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const recentLogs = sorted.slice(-maxPills);
  const emptySlots = Math.max(0, maxPills - recentLogs.length);

  const upCount = recentLogs.filter((l) => l.is_up).length;
  const uptimePercent =
    recentLogs.length > 0 ? ((upCount / recentLogs.length) * 100).toFixed(1) : "100.0";

  const [localHoveredLog, setLocalHoveredLog] = useState<PingLog | null>(null);

  return (
    <div className="w-full space-y-2 select-none relative">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
        <span className="text-slate-300 font-medium">Uptime Stream (Last {maxPills} checks)</span>
        <span className={Number(uptimePercent) < 100 ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
          {uptimePercent}%
        </span>
      </div>

      {/* Pill Stream */}
      <div className="flex items-center gap-1 w-full p-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="h-5 flex-1 min-w-[3px] rounded-[2px] bg-slate-800/40"
            title="Awaiting probe sample"
          />
        ))}

        {recentLogs.map((log, idx) => {
          const isUp = log.is_up;
          const isTargeted = activeIndex === idx;

          return (
            <button
              key={log.id}
              type="button"
              onMouseEnter={() => {
                setLocalHoveredLog(log);
                if (onHoverIndex) onHoverIndex(idx);
              }}
              onMouseLeave={() => {
                setLocalHoveredLog(null);
                if (onHoverIndex) onHoverIndex(null);
              }}
              onClick={() => onSelectLog && onSelectLog(log)}
              className={`h-5 flex-1 min-w-[3px] rounded-[2px] transition-all duration-150 cursor-pointer ${
                isUp
                  ? "bg-emerald-500/80 hover:bg-emerald-400"
                  : "bg-rose-500/90 hover:bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse"
              } ${isTargeted ? "scale-y-125 brightness-150 ring-2 ring-white/70" : ""}`}
            />
          );
        })}
      </div>

      {/* Surface-Level Triage Banner on Hover */}
      {localHoveredLog ? (
        <div
          onClick={() => onSelectLog && onSelectLog(localHoveredLog)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-[11px] font-mono shadow-lg cursor-pointer transition-all duration-150 ${
            localHoveredLog.is_up
              ? "bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500"
              : "bg-rose-950/90 border-rose-700/80 text-rose-100 hover:border-rose-500"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                localHoveredLog.is_up ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <span className="font-semibold text-white">
              {localHoveredLog.status_code
                ? `HTTP ${localHoveredLog.status_code}`
                : "Timeout / Error"}
            </span>
            <span className="text-slate-500">·</span>
            <span>{localHoveredLog.latency_ms ?? 0} ms</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {new Date(localHoveredLog.created_at).toLocaleTimeString()}
            </span>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold ${
              localHoveredLog.is_up ? "text-emerald-400" : "text-rose-300 underline"
            }`}
          >
            Click for Autopsy →
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>Older</span>
          <span>Most Recent</span>
        </div>
      )}
    </div>
  );
}