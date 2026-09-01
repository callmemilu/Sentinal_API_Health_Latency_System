export interface PingResult {
  statusCode: number | null;
  latencyMs: number;
  isUp: boolean;
  errorMessage: string | null;
}

/**
 * Pings an HTTP/HTTPS endpoint with strict timeout enforcement
 * and high-resolution latency measurement.
 */
export async function pingEndpoint(
  url: string,
  method: string = 'GET',
  timeoutMs: number = 5000
): Promise<PingResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Sentinel-Health-Probe/1.0',
        'Accept': '*/*',
      },
      // Prevents caching so we measure real network round-trip time
      cache: 'no-store',
    });

    const endTime = performance.now();
    clearTimeout(timeoutId);

    const latencyMs = Math.round(endTime - startTime);
    const isUp = response.status >= 200 && response.status < 400;

    return {
      statusCode: response.status,
      latencyMs,
      isUp,
      errorMessage: isUp ? null : `HTTP status ${response.status}`,
    };
  } catch (error: unknown) {
    const endTime = performance.now();
    clearTimeout(timeoutId);

    const latencyMs = Math.round(endTime - startTime);
    let errorMessage = 'Unknown network error';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `Request timed out after ${timeoutMs}ms`;
      } else {
        errorMessage = error.message;
      }
    }

    return {
      statusCode: null,
      latencyMs,
      isUp: false,
      errorMessage,
    };
  }
}