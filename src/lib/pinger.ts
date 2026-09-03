

/**
 * Pings an HTTP/HTTPS endpoint with strict timeout enforcement
 * and high-resolution latency measurement.
 */
export interface PingResult {
  isUp: boolean;
  statusCode: number | null;
  latencyMs: number;
  errorMessage: string | null;
}

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
        'User-Agent': 'Sentinel-Monitor/1.0',
        'Accept': '*/*',
      },
    });

    const latencyMs = Math.round(performance.now() - startTime);
    clearTimeout(timeoutId);

    const isUp = response.status >= 200 && response.status < 400;

    return {
      isUp,
      statusCode: response.status,
      latencyMs,
      errorMessage: isUp ? null : `HTTP status ${response.status}`,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : error.message;
    }

    return {
      isUp: false,
      statusCode: null,
      latencyMs,
      errorMessage: message,
    };
  }
}