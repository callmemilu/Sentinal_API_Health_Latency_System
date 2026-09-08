"use client";

import React, { useState } from "react";
import { X, Copy, Check, Terminal, AlertOctagon, CheckCircle2, ShieldAlert } from "lucide-react";

export interface PingLog {
  id: string;
  is_up: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error_message?: string | null;
  created_at: string;
}

interface IncidentAutopsyDrawerProps {
  log: PingLog | null;
  monitorName: string;
  monitorUrl: string;
  monitorMethod: string;
  onClose: () => void;
}

export default function IncidentAutopsyDrawer({
  log,
  monitorName,
  monitorUrl,
  monitorMethod,
  onClose,
}: IncidentAutopsyDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const curlCommand = `curl -i -X ${monitorMethod || "GET"} "${monitorUrl}"`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              {log.is_up ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-rose-500 animate-pulse" />
              )}
              <h2 className="text-lg font-bold text-white tracking-tight">
                Incident Forensics & Autopsy
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider font-mono text-slate-500">Monitor</span>
            <h3 className="text-base font-semibold text-slate-200">{monitorName}</h3>
            <p className="text-xs font-mono text-slate-400 break-all">{monitorUrl}</p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">HTTP Verdict</span>
              <span className={`text-base font-bold ${log.is_up ? "text-emerald-400" : "text-rose-400"}`}>
                {log.status_code ? `HTTP ${log.status_code}` : "NO_RESPONSE"}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Measured Latency</span>
              <span className="text-base font-bold text-white">{log.latency_ms ?? 0} ms</span>
            </div>
          </div>

          {/* Diagnostic Error Details */}
          {!log.is_up && (
            <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900/60 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-semibold">
                <AlertOctagon className="h-4 w-4" />
                <span>Root Cause Exception</span>
              </div>
              <p className="text-xs font-mono text-rose-200 break-words">
                {log.error_message || "Target endpoint aborted connection without returning an HTTP status."}
              </p>
            </div>
          )}

          {/* cURL Reproduction Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Terminal className="h-3.5 w-3.5" />
                Terminal Reproduction
              </span>
              <button
                onClick={handleCopyCurl}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy cURL"}
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-black border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto select-all">
              {curlCommand}
            </pre>
          </div>

          {/* Metadata */}
          <div className="pt-2 text-xs font-mono text-slate-500 space-y-1">
            <p>Execution ID: {log.id}</p>
            <p>Probe Timestamp: {new Date(log.created_at).toISOString()}</p>
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition"
        >
          Close Forensics
        </button>
      </div>
    </div>
  );
}