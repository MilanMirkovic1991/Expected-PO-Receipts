import { describe, it, expect, vi } from 'vitest';
import { createMailer, type MailerTransport } from '../../src/services/mailer.js';

describe('mailer', () => {
  it('sends task notification email and returns messageId', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const transport: MailerTransport = { sendMail };
    const mailer = createMailer(transport, { from: 'no-reply@x', appBaseUrl: 'http://app' });
    const r = await mailer.sendTaskCreated({ toEmail: 'w@x', taskId: 12, itemCount: 3, dateRange: '2026-05-28 .. 2026-06-03' });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('msg-1');
    expect(sendMail).toHaveBeenCalledOnce();
    const args = sendMail.mock.calls[0]![0];
    expect(args.to).toBe('w@x');
    expect(args.subject).toContain('Task #12');
    expect(args.html).toContain('http://app/receiving/12');
  });

  it('returns success=false on transport error', async () => {
    const transport: MailerTransport = { sendMail: vi.fn().mockRejectedValue(new Error('smtp down')) };
    const mailer = createMailer(transport, { from: 'no-reply@x', appBaseUrl: 'http://app' });
    const r = await mailer.sendTaskCreated({ toEmail: 'w@x', taskId: 12, itemCount: 1, dateRange: 'x' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('smtp down');
  });
});
