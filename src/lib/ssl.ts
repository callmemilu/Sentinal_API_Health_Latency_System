import tls from "tls";
import { URL } from "url";

export interface SslCheckResult {
  valid: boolean;
  daysRemaining: number | null;
  issuer: string | null;
  validTo: string | null;
  error?: string;
}

export async function checkSslCertificate(
  targetUrl: string,
  timeoutMs: number = 4000
): Promise<SslCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { valid: false, daysRemaining: null, issuer: null, validTo: null, error: "Invalid URL" };
  }

  // Plain HTTP endpoints have no TLS certificate
  if (parsed.protocol !== "https:") {
    return { valid: true, daysRemaining: null, issuer: null, validTo: null };
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : 443;
  const host = parsed.hostname;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host, // SNI support
        rejectUnauthorized: false, // Allows inspecting even expired or self-signed certs
      },
      () => {
        const cert = socket.getPeerCertificate();

        if (!cert || !cert.valid_to) {
          socket.destroy();
          return resolve({
            valid: false,
            daysRemaining: null,
            issuer: null,
            validTo: null,
            error: "No certificate presented",
          });
        }

        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const diffTime = validTo.getTime() - now.getTime();
        const daysRemaining = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const issuerValue = cert.issuer?.O || cert.issuer?.CN;
        const issuer = Array.isArray(issuerValue)
          ? issuerValue.join(", ")
          : issuerValue || "Unknown Issuer";

        socket.destroy();
        resolve({
          valid: daysRemaining > 0,
          daysRemaining,
          issuer,
          validTo: validTo.toISOString(),
        });
      }
    );

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({
        valid: false,
        daysRemaining: null,
        issuer: null,
        validTo: null,
        error: `TLS handshake timed out after ${timeoutMs}ms`,
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({
        valid: false,
        daysRemaining: null,
        issuer: null,
        validTo: null,
        error: err.message,
      });
    });
  });
}