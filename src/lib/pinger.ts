import { supabaseAdmin } from "@/lib/supabase/admin";

export interface PingResult {
  isUp: boolean;
  statusCode: number | null;
  latencyMs: number;
  errorMessage: string | null;
}

export interface MonitorRecord {
  id: string;
  url: string;
  method?: string;
  timeout_ms?: number;
  status?: string;
}

/**
 * Pings an HTTP/HTTPS endpoint with strict timeout enforcement,
 * writes the resulting telemetry to Supabase, and updates monitor status.
 */
export async function pingEndpoint(monitor: MonitorRecord): Promise<PingResult> {
  const url = monitor.url;
  const method = monitor.method || "GET";
  const timeoutMs = monitor.timeout_ms || 5000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = performance.now();

  let isUp = false;
  let statusCode: number | null = null;
  let latencyMs = 0;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        "User-Agent": "Sentinel-Monitor/1.0",
        Accept: "*/*",
      },
    });

    latencyMs = Math.round(performance.now() - startTime);
    clearTimeout(timeoutId);
    statusCode = response.status;
    isUp = response.status >= 200 && response.status < 400;

    if (!isUp) {
      errorMessage = `HTTP status ${response.status}`;
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    latencyMs = Math.round(performance.now() - startTime);
    isUp = false;

    if (error instanceof Error) {
      errorMessage =
        error.name === "AbortError"
          ? `Request timed out after ${timeoutMs}ms`
          : error.message;
    } else {
      errorMessage = "Unknown error";
    }
  }

  // 1. Insert telemetry record into Supabase ping_logs
  const { error: insertError } = await supabaseAdmin.from("ping_logs").insert({
    monitor_id: monitor.id,
    is_up: isUp, // <-- Add this line
    status_code: statusCode,
    latency_ms: latencyMs,
    error_message: errorMessage,
  });

  if (insertError) {
    console.error("🔴 Supabase ping_logs insert error:", insertError.message);
  } else {
    console.log(`🟢 Ping saved for ${url} -> ${statusCode ?? "ERR"} (${latencyMs}ms)`);
  }

  // 2. Update the monitor's operational status
  const newStatus = isUp ? "Operational" : "Down";
  await supabaseAdmin
    .from("monitors")
    .update({ status: newStatus })
    .eq("id", monitor.id);

  return {
    isUp,
    statusCode,
    latencyMs,
    errorMessage,
  };
}