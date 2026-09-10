import { NextRequest, NextResponse } from "next/server";
import https from "https";
import http from "http";
import { URL } from "url";

export const runtime = "nodejs";

export interface ProbeDiagnosticResult {
  statusCode: number;
  statusText: string;
  ip: string;
  region: string;
  timings: {
    dns: number;
    tcp: number;
    tls: number;
    ttfb: number;
    transfer: number;
    total: number;
  };
  traceHeaders: {
    requestId?: string;
    cfRay?: string;
    amznTraceId?: string;
    traceparent?: string;
    server?: string;
  };
  requestHeaders: Record<string, string>;
  responseBody: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string; method?: string };
    const { url: targetUrl, method = "GET" } = body;

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing target URL" }, { status: 400 });
    }

    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === "https:";
    const client = isHttps ? https : http;

    const requestHeaders: Record<string, string> = {
      "User-Agent": "Sentinel-Diagnostic-Probe/1.0",
      Accept: "*/*",
      "Cache-Control": "no-cache",
      Connection: "close", // Disable keep-alive
    };

    const diagnostic = await new Promise<ProbeDiagnosticResult>((resolve, reject) => {
      const startTime = performance.now();
      let dnsTime = 0;
      let tcpTime = 0;
      let tlsTime = 0;
      let ttfbTime = 0;
      let remoteIp = "unknown";

      const request = client.request(
        targetUrl,
        {
          method,
          headers: requestHeaders,
          timeout: 8000,
          agent: false, // Disables socket pooling to measure authentic cold handshakes
        },
        (res) => {
          ttfbTime = performance.now() - startTime;

          // Resolve remote IP from socket if DNS was cached
          if (remoteIp === "unknown" && res.socket?.remoteAddress) {
            remoteIp = res.socket.remoteAddress;
          }

          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const total = performance.now() - startTime;
            const fullBody = Buffer.concat(chunks).toString("utf-8");
            const responseBody =
              fullBody.length > 2048
                ? fullBody.slice(0, 2048) + "... [truncated]"
                : fullBody;

            const headers = res.headers;
            resolve({
              statusCode: res.statusCode || 0,
              statusText: res.statusMessage || "Unknown",
              ip: remoteIp,
              region: process.env.VERCEL_REGION || "local-dev",
              timings: {
                dns: Math.max(0, Math.round(dnsTime)),
                tcp: Math.max(0, Math.round(tcpTime)),
                tls: Math.max(0, Math.round(tlsTime)),
                ttfb: Math.max(
                  0,
                  Math.round(ttfbTime - (dnsTime + tcpTime + tlsTime))
                ),
                transfer: Math.max(0, Math.round(total - ttfbTime)),
                total: Math.round(total),
              },
              traceHeaders: {
                requestId: typeof headers["x-request-id"] === "string" ? headers["x-request-id"] : undefined,
                cfRay: typeof headers["cf-ray"] === "string" ? headers["cf-ray"] : undefined,
                amznTraceId: typeof headers["x-amzn-trace-id"] === "string" ? headers["x-amzn-trace-id"] : undefined,
                traceparent: typeof headers["traceparent"] === "string" ? headers["traceparent"] : undefined,
                server: typeof headers["server"] === "string" ? headers["server"] : undefined,
              },
              requestHeaders,
              responseBody,
            });
          });
        }
      );

      request.on("socket", (socket) => {
        socket.on("lookup", (_err, address) => {
          remoteIp = address;
          dnsTime = performance.now() - startTime;
        });
        socket.on("connect", () => {
          tcpTime = performance.now() - startTime - dnsTime;
        });
        socket.on("secureConnect", () => {
          tlsTime = performance.now() - startTime - dnsTime - tcpTime;
        });
      });

      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Probe diagnostic timed out after 8000ms"));
      });

      request.on("error", (err) => reject(err));
      request.end();
    });

    return NextResponse.json(diagnostic);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to execute probe diagnostic";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}