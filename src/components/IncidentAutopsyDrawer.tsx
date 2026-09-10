"use client";

import React, { useState, useMemo } from "react";
import { PingLog } from "@/components/StatusPillStream";
import type { ProbeDiagnosticResult } from "@/app/api/probe/diagnose/route";
import {
  X,
  Copy,
  Check,
  RefreshCw,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  Server,
  Activity,
  Terminal,
  Code2,
  Clock,
  History,
  Radio,
} from "lucide-react";

interface IncidentAutopsyDrawerProps {
  log: PingLog | null;
  monitorName: string;
  monitorUrl: string;
  monitorMethod?: string;
  consecutiveFailures?: number;
  siblingOutages?: string[];
  onClose: () => void;
}

export default function IncidentAutopsyDrawer({
  log,
  monitorName,
  monitorUrl,
  monitorMethod = "GET",
  consecutiveFailures = 1,
  siblingOutages = [],
  onClose,
}: IncidentAutopsyDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<"curl" | "node" | "python">("curl");
  const [payloadView, setPayloadView] = useState<"formatted" | "raw">("formatted");
  const [isReprobing, setIsReprobing] = useState(false);
  const [liveDiag, setLiveDiag] = useState<ProbeDiagnosticResult | null>(null);

  const isHealthy = Boolean(log?.is_up && (log?.status_code ? log.status_code < 400 : true));

  const resolveVerdict = (): string => {
    if (!log) return "No Data";
    if (log.status_code && log.status_code > 0) {
      return `HTTP ${log.status_code}`;
    }
    const err = (log.error_message || "").toLowerCase();
    if (err.includes("timeout") || (log.latency_ms ?? 0) >= 5000) {
      return "Request Timeout";
    }
    if (err.includes("econnrefused") || err.includes("refused")) {
      return "Connection Refused";
    }
    if (err.includes("enotfound") || err.includes("getaddrinfo")) {
      return "DNS Resolution Failed";
    }
    if (err.includes("cert") || err.includes("tls") || err.includes("ssl")) {
      return "TLS / SSL Handshake Error";
    }
    return isHealthy ? "HTTP 200" : "Network Abort";
  };

  const verdict = resolveVerdict();

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const runLiveDiagnostic = async () => {
    setIsReprobing(true);
    try {
      const res = await fetch("/api/probe/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: monitorUrl, method: monitorMethod }),
      });
      if (!res.ok) throw new Error("Probe failed");
      const data = (await res.json()) as ProbeDiagnosticResult;
      setLiveDiag(data);
    } catch (error: unknown) {
      console.error(error);
    } finally {
      setIsReprobing(false);
    }
  };

  const rawPayload = liveDiag
    ? liveDiag.responseBody || "(Empty response body returned)"
    : log?.error_message ||
      (isHealthy
        ? `Historical probe passed at ${log?.created_at ? new Date(log.created_at).toLocaleTimeString() : ""}.\nRaw response body was not persisted to minimize database storage.\nClick "Probe Now" to capture live response body & headers.`
        : `Endpoint failed without capturing response payload.\nClick "Probe Now" to stream live failure headers.`);

  const formattedPayload = useMemo(() => {
    if (!liveDiag?.responseBody) return rawPayload;
    const body = liveDiag.responseBody.trim();

    if ((body.startsWith("{") && body.endsWith("}")) || (body.startsWith("[") && body.endsWith("]"))) {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }

    if (body.toLowerCase().includes("<!doctype html") || body.toLowerCase().includes("<html")) {
      const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "Untitled Web Page";
      const isWaf =
        body.includes("safeline") ||
        body.includes("cf-browser-verification") ||
        body.includes("challenge");

      return [
        `[HTML Document Detected - Length: ${body.length} bytes]`,
        `Document Title: "${title}"`,
        isWaf ? `Firewall Signature: SafeLine / WAF Interception Challenge` : null,
        "",
        "Extracted Content Preview:",
        body
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, "[Base64 Image Omitted]")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 400) + (body.length > 400 ? "..." : ""),
      ]
        .filter(Boolean)
        .join("\n");
    }

    return body;
  }, [liveDiag, rawPayload]);

  const activePayloadText = payloadView === "formatted" ? formattedPayload : rawPayload;

  if (!log) return null;

  const formatMs = (val: number) => (val === 0 ? "< 1ms" : `${val}ms`);

  const timings = liveDiag?.timings;
  const totalTime = timings ? Math.max(timings.total, 1) : Math.max(log.latency_ms ?? 1, 1);
  const dnsPct = timings ? (timings.dns / totalTime) * 100 : 0;
  const tcpPct = timings ? (timings.tcp / totalTime) * 100 : 0;
  const tlsPct = timings ? (timings.tls / totalTime) * 100 : 0;
  const ttfbPct = timings ? (timings.ttfb / totalTime) * 100 : 0;
  const transferPct = timings ? (timings.transfer / totalTime) * 100 : 0;

  const snippets = {
    curl: `curl -iv -X ${monitorMethod} "${monitorUrl}" \\\n  -H "User-Agent: Sentinel-Diagnostic/1.0" \\\n  --max-time 10`,
    node: `// Node.js (v18+ native fetch)\nconst res = await fetch("${monitorUrl}", {\n  method: "${monitorMethod}",\n  headers: { "User-Agent": "Sentinel-Diagnostic/1.0" },\n  signal: AbortSignal.timeout(10000)\n});\nconsole.log(res.status, await res.text());`,
    python: `# Python (requests)\nimport requests\n\ntry:\n    res = requests.request(\n        method="${monitorMethod}",\n        url="${monitorUrl}",\n        headers={"User-Agent": "Sentinel-Diagnostic/1.0"},\n        timeout=10\n    )\n    print("Status:", res.status_code)\n    print(res.text[:250])\nexcept Exception as e:\n    print("Probe Failed:", e)`,
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="h-full w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 text-zinc-100 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isHealthy ? "border-emerald-900/40 bg-zinc-900/60" : "border-rose-900/50 bg-zinc-900/60"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              {isHealthy ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              )}
              <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-200 font-mono">
                {isHealthy ? "Telemetry Sample Diagnostics" : "Incident Autopsy & Forensics"}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-1">
              Target: <strong className="text-zinc-200">{monitorName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs">
          {/* Health / Incident Context */}
          {isHealthy ? (
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Operational Status Confirmed</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                  Healthy
                </span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Endpoint responded with operational HTTP headers within normal latency thresholds. No packet drop or SLA violation detected.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-medium">
                  <AlertOctagon className="w-4 h-4" />
                  <span>Incident Blast Radius</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                  Failure #{consecutiveFailures} in sequence
                </span>
              </div>
              {siblingOutages.length > 0 ? (
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  <strong className="text-rose-400">Shared Host Outage:</strong> {siblingOutages.length} other monitor(s) on this hostname are failing. Upstream DNS or gateway degradation suspected.
                </p>
              ) : (
                <p className="text-zinc-400 text-[11px]">
                  Isolated Endpoint Outage: Sibling monitors on this hostname remain operational.
                </p>
              )}
            </div>
          )}

          {/* Metrics Header with Snapshot Tag */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                Historical Snapshot Telemetry
              </span>
              <span className="text-[10px] text-zinc-500">
                Logged at: {new Date(log.created_at).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                <p className="text-zinc-500 text-[10px] uppercase">HTTP Verdict</p>
                <p className={`text-sm font-bold mt-1 truncate ${isHealthy ? "text-emerald-400" : "text-rose-400"}`}>
                  {verdict}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                <p className="text-zinc-500 text-[10px] uppercase">Recorded Latency</p>
                <p className="text-sm font-bold text-zinc-100 mt-1">{log.latency_ms ?? 0} ms</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
                <p className="text-zinc-500 text-[10px] uppercase">Live Probe</p>
                <button
                  onClick={runLiveDiagnostic}
                  disabled={isReprobing}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition disabled:opacity-50 mt-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isReprobing ? "animate-spin" : ""}`} />
                  {isReprobing ? "Probing..." : "Probe Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Live Diagnostic Result Banner */}
          {liveDiag && (
            <div
              className={`p-3.5 rounded-lg border space-y-1.5 ${
                liveDiag.statusCode >= 200 && liveDiag.statusCode < 400
                  ? "border-emerald-800/80 bg-emerald-950/30 text-emerald-300"
                  : "border-rose-800/80 bg-rose-950/30 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  <span className="font-bold">Live Probe Result: HTTP {liveDiag.statusCode}</span>
                </div>
                <span className="font-semibold">{liveDiag.timings.total} ms</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5 border-t border-zinc-800/50">
                <span>Region: <strong className="text-zinc-200">{liveDiag.region}</strong></span>
                <span>Target IP: <strong className="text-zinc-200 font-mono">{liveDiag.ip}</strong></span>
              </div>
            </div>
          )}

          {/* Network Latency Waterfall */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                Network Phase Waterfall
              </span>
              <span className="text-zinc-500 text-[10px]">
                {timings ? `Measured Total: ${timings.total} ms` : `Total Recorded: ${log.latency_ms ?? 0} ms`}
              </span>
            </div>

            {timings ? (
              <>
                <div className="h-3.5 w-full flex rounded overflow-hidden bg-zinc-900 border border-zinc-800">
                  <div style={{ width: `${dnsPct}%` }} className="bg-sky-500" title={`DNS: ${formatMs(timings.dns)}`} />
                  <div style={{ width: `${tcpPct}%` }} className="bg-indigo-500" title={`TCP: ${formatMs(timings.tcp)}`} />
                  <div style={{ width: `${tlsPct}%` }} className="bg-amber-500" title={`TLS: ${formatMs(timings.tls)}`} />
                  <div
                    style={{ width: `${ttfbPct}%` }}
                    className={isHealthy ? "bg-emerald-500" : "bg-rose-500"}
                    title={`TTFB: ${formatMs(timings.ttfb)}`}
                  />
                  <div style={{ width: `${transferPct}%` }} className="bg-teal-400" title={`Transfer: ${formatMs(timings.transfer)}`} />
                </div>
                <div className="grid grid-cols-5 gap-1 pt-1 text-[10px] text-zinc-400">
                  <div><span className="text-sky-400 font-bold">DNS:</span> {formatMs(timings.dns)}</div>
                  <div><span className="text-indigo-400 font-bold">TCP:</span> {formatMs(timings.tcp)}</div>
                  <div><span className="text-amber-400 font-bold">TLS:</span> {formatMs(timings.tls)}</div>
                  <div><span className={isHealthy ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>TTFB:</span> {formatMs(timings.ttfb)}</div>
                  <div><span className="text-teal-400 font-bold">Xfer:</span> {formatMs(timings.transfer)}</div>
                </div>
              </>
            ) : (
              <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span>Historical snapshot stores total duration ({log.latency_ms ?? 0} ms).</span>
                </div>
                <span className="text-[10px] text-zinc-500">Run &quot;Probe Now&quot; for socket breakdown</span>
              </div>
            )}
          </div>

          {/* Observability & Tracing Metadata */}
          <div className="space-y-2">
            <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Observability &amp; Gateway Headers
            </span>
            <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center py-0.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">CF-Ray:</span>
                <span className="text-zinc-300 font-mono select-all">
                  {liveDiag ? liveDiag.traceHeaders?.cfRay || "Not present in response" : "Requires live probe"}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-zinc-800/60">
                <span className="text-zinc-500">X-Request-ID:</span>
                <span className="text-zinc-300 font-mono select-all">
                  {liveDiag ? liveDiag.traceHeaders?.requestId || "Not returned by host" : "Requires live probe"}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-zinc-500">Probe Region:</span>
                <span className="text-zinc-300 font-mono">
                  {liveDiag ? liveDiag.region : "Recorded from cron cluster"}
                </span>
              </div>
            </div>
          </div>

          {/* Response Payload with Formatted/Raw Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  Response Payload
                </span>
                {liveDiag?.responseBody && (
                  <div className="flex rounded bg-zinc-900 border border-zinc-800 p-0.5 text-[10px]">
                    <button
                      onClick={() => setPayloadView("formatted")}
                      className={`px-2 py-0.5 rounded transition ${
                        payloadView === "formatted" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Formatted
                    </button>
                    <button
                      onClick={() => setPayloadView("raw")}
                      className={`px-2 py-0.5 rounded transition ${
                        payloadView === "raw" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => copyToClipboard(activePayloadText, "payload")}
                className="text-zinc-500 hover:text-zinc-200 transition flex items-center gap-1"
              >
                {copiedKey === "payload" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedKey === "payload" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-black border border-zinc-800 text-zinc-300 overflow-x-auto text-[11px] leading-relaxed max-h-40 whitespace-pre-wrap">
              {activePayloadText}
            </pre>
          </div>

          {/* Terminal Reproduction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                Terminal Reproduction
              </span>
              <div className="flex rounded bg-zinc-900 border border-zinc-800 p-0.5">
                {(["curl", "node", "python"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCodeTab(tab)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      codeTab === tab ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative rounded-lg bg-black border border-zinc-800 p-3">
              <button
                onClick={() => copyToClipboard(snippets[codeTab], "snippet")}
                className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-zinc-200 transition flex items-center gap-1"
              >
                {copiedKey === "snippet" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedKey === "snippet" ? "Copied" : "Copy"}
              </button>
              <pre className="text-zinc-300 overflow-x-auto text-[11px] leading-relaxed pr-14">
                {snippets[codeTab]}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-zinc-500 text-[10px]">
          <span>Log UUID: {log.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition"
          >
            {isHealthy ? "Close Diagnostics" : "Close Autopsy"}
          </button>
        </div>
      </div>
    </div>
  );
}