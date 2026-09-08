import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface AlertPayload {
  monitorName: string;
  url: string;
  statusCode: number | null;
  latencyMs: number | null;
  errorMessage?: string | null;
  isRecovery: boolean;
  discordWebhookUrl?: string | null;
  notifyEmail?: string | null;
}

export async function dispatchAlerts({
  monitorName,
  url,
  statusCode,
  latencyMs,
  errorMessage,
  isRecovery,
  discordWebhookUrl,
  notifyEmail,
}: AlertPayload) {
  const statusTitle = isRecovery ? '🟢 SERVICE RECOVERED' : '🔴 SERVICE OUTAGE DETECTED';
  const color = isRecovery ? 0x22c55e : 0xef4444; // Hex green or red

  // 1. Dispatch Discord Webhook
  if (discordWebhookUrl && discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Sentinel Monitor',
          embeds: [
            {
              title: statusTitle,
              description: `**${monitorName}** is ${isRecovery ? 'back online and responding normally.' : 'failing synthetic health probes.'}`,
              color,
              fields: [
                { name: 'Target URL', value: `\`${url}\``, inline: false },
                { name: 'HTTP Status', value: statusCode ? `${statusCode}` : 'No Response', inline: true },
                { name: 'Latency', value: `${latencyMs ?? 0}ms`, inline: true },
                { name: 'Details', value: errorMessage || 'N/A', inline: false },
              ],
              timestamp: new Date().toISOString(),
              footer: { text: 'Sentinel Autonomous Telemetry' },
            },
          ],
        }),
      });
    } catch (err) {
      console.error('Failed to dispatch Discord webhook:', err);
    }
  }

  // 2. Dispatch Resend Email
  if (notifyEmail && resend) {
    try {
      await resend.emails.send({
        from: 'Sentinel Alerts <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `[${isRecovery ? 'RECOVERED' : 'OUTAGE'}] ${monitorName}`,
        html: `
          <div style="font-family: monospace; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 8px;">
            <h2 style="color: ${isRecovery ? '#4ade80' : '#f87171'}; margin-top: 0;">${statusTitle}</h2>
            <p><strong>Monitor:</strong> ${monitorName}</p>
            <p><strong>Endpoint:</strong> ${url}</p>
            <p><strong>HTTP Status:</strong> ${statusCode ?? 'Timed Out'}</p>
            <p><strong>Response Duration:</strong> ${latencyMs ?? 0}ms</p>
            ${errorMessage ? `<p><strong>Error Trace:</strong> ${errorMessage}</p>` : ''}
            <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">Triggered by Sentinel Health Engine at ${new Date().toUTCString()}</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Failed to dispatch Resend email:', err);
    }
  }
}