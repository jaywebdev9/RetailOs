import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  async send(to: string, subject: string, text: string, html?: string) {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.log.warn(`[DEV email → ${to}] ${subject}\n${text}`);
      return { ok: true, mode: 'log' as const };
    }

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@retailos.local',
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br/>'),
      });
      return { ok: true, mode: 'smtp' as const };
    } catch (err: any) {
      this.log.error(`Email failed: ${err?.message || err}`);
      this.log.warn(`[FALLBACK log → ${to}] ${subject}\n${text}`);
      return { ok: false, mode: 'log' as const };
    }
  }
}
