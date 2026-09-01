import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface AlertPayload {
  monitorName: string;
  url: string;
  status: 'DOWN' | 'RECOVERED';
  statusCode: number | null;
  latencyMs: number;
  errorMessage?: string | null;
  timestamp: string;
}

/**
 * Dispatches a formatted Discord Embed card.
 */
export async function sendDiscordAlert(webhookUrl: string, alert: AlertPayload): Promise<boolean> {
  if (!webhookUrl) return false;

  const isDown = alert.status === 'DOWN';
  const color = isDown ? 0xef4444 : 0x22c55e; // Red or Green
  const title = isDown ? `🚨 INCIDENT: ${alert.monitorName} is DOWN` : `✅ RECOVERED: ${alert.monitorName} is BACK UP`;

  const embed = {
    title,
    color,
    fields: [
      { name: 'Target URL', value: alert.url, inline: false },
      { name: 'Status Code', value: alert.statusCode ? `${alert.statusCode}` : 'N/A', inline: true },
      { name: 'Latency', value: `${alert.latencyMs}ms`, inline: true },
      { name: 'Timestamp (UTC)', value: alert.timestamp, inline: false },
    ],
    footer: { text: 'Sentinel Synthetic Monitoring' },
  };

  if (isDown && alert.errorMessage) {
    embed.fields.push({ name: 'Error', value: alert.errorMessage, inline: false });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to send Discord alert:', error);
    return false;
  }
}

/**
 * Dispatches a transactional email alert via Resend.
 */
export async function sendEmailAlert(toEmail: string, alert: AlertPayload): Promise<boolean> {
  if (!resend || !toEmail) return false;

  const isDown = alert.status === 'DOWN';
  const subject = isDown
    ? `[ALERT] Sentinel: ${alert.monitorName} is DOWN`
    : `[RECOVERED] Sentinel: ${alert.monitorName} is Operational`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #111827;">
      <h2 style="color: ${isDown ? '#dc2626' : '#16a34a'};">${subject}</h2>
      <p>Your monitored endpoint has experienced a status transition.</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Target URL:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.url}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Status Code:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.statusCode ?? 'N/A'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Latency:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.latencyMs}ms</td></tr>
        ${isDown && alert.errorMessage ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Error:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.errorMessage}</td></tr>` : ''}
      </table>
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Sentinel Synthetic Monitoring</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Sentinel Alerts <onboarding@resend.dev>', // Default Resend test sender
      to: toEmail,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Failed to send Resend email alert:', error);
    return false;
  }
}