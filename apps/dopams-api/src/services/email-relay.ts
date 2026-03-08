import { query } from "../db";

export interface EmailRelayConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromAddress?: string;
}

/**
 * FR-24 AC-04: Email relay stub for notification delivery.
 * In production, replace with actual SMTP transport (nodemailer or similar).
 */
export function createEmailRelay(config: EmailRelayConfig = {}) {
  const isConfigured = !!config.smtpHost;

  async function sendEmail(to: string, subject: string, body: string): Promise<{ sent: boolean; messageId?: string }> {
    if (!isConfigured) {
      // Stub mode: log the email and record in notification_email_log
      console.warn(`EMAIL_RELAY_STUB: Would send email to=${to} subject="${subject}"`);
      await query(
        `INSERT INTO notification_email_log (recipient, subject, body, status, sent_at)
         VALUES ($1, $2, $3, 'STUB', NOW())
         ON CONFLICT DO NOTHING`,
        [to, subject, body],
      ).catch(() => { /* table may not exist yet */ });
      return { sent: false };
    }

    // Production: integrate nodemailer here
    // const transporter = nodemailer.createTransport({ host: config.smtpHost, ... });
    // const info = await transporter.sendMail({ from: config.fromAddress, to, subject, text: body });
    // return { sent: true, messageId: info.messageId };

    return { sent: false };
  }

  async function dispatchPendingEmails(): Promise<number> {
    // Poll notification table for unsent email notifications and dispatch them
    const pending = await query(
      `SELECT n.notification_id, n.recipient_id, n.title, n.body, u.email
       FROM notification n
       JOIN app_user u ON u.user_id = n.recipient_id
       WHERE n.channel = 'EMAIL' AND n.sent_at IS NULL
       ORDER BY n.created_at
       LIMIT 50`,
    ).catch(() => ({ rows: [] }));

    let dispatched = 0;
    for (const row of pending.rows) {
      if (!row.email) continue;
      const result = await sendEmail(row.email, row.title, row.body);
      if (result.sent || !isConfigured) {
        await query(`UPDATE notification SET sent_at = NOW() WHERE notification_id = $1`, [row.notification_id]);
        dispatched++;
      }
    }
    return dispatched;
  }

  return { sendEmail, dispatchPendingEmails, isConfigured };
}
