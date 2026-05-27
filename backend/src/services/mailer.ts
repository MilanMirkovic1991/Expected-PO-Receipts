import nodemailer from 'nodemailer';

export type MailerTransport = { sendMail: (opts: any) => Promise<{ messageId: string }> };

export type SendTaskCreatedInput = { toEmail: string; taskId: number; itemCount: number; dateRange: string };
export type SendResult = { success: boolean; messageId?: string; error?: string };

export type Mailer = { sendTaskCreated(input: SendTaskCreatedInput): Promise<SendResult> };

export function createMailer(transport: MailerTransport, cfg: { from: string; appBaseUrl: string }): Mailer {
  return {
    async sendTaskCreated(input) {
      const url = `${cfg.appBaseUrl}/receiving/${input.taskId}`;
      const html = `
        <p>You have a new <strong>Expected POs</strong> task.</p>
        <p>Task #${input.taskId} — ${input.itemCount} item(s) — ${input.dateRange}</p>
        <p><a href="${url}">Open task →</a></p>
      `;
      try {
        const { messageId } = await transport.sendMail({
          from: cfg.from, to: input.toEmail,
          subject: `Expected POs — Task #${input.taskId}`,
          html, text: `New task #${input.taskId} (${input.itemCount} items, ${input.dateRange}). Open: ${url}`,
        });
        return { success: true, messageId };
      } catch (e: any) {
        return { success: false, error: e?.message ?? 'unknown' };
      }
    },
  };
}

export function createSmtpTransport(cfg: { host: string; port: number; secure: boolean; user: string; pass: string }): MailerTransport {
  return nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  }) as MailerTransport;
}
