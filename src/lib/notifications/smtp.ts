import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export type EmailSendResult = {
  messageId: string;
};

/* eslint-disable no-unused-vars */
export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
/* eslint-enable no-unused-vars */

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSmtpConfig(): SmtpConfig {
  return {
    host: getRequiredEnv("SMTP_HOST"),
    port: Number.parseInt(process.env.SMTP_PORT?.trim() ?? "587", 10),
    secure: (process.env.SMTP_SECURE ?? "false").trim().toLowerCase() === "true",
    user: getRequiredEnv("SMTP_USER"),
    pass: getRequiredEnv("SMTP_PASS"),
    fromEmail: getRequiredEnv("SMTP_FROM_EMAIL"),
    fromName: (process.env.SMTP_FROM_NAME ?? "Anclora Advisor AI").trim(),
  };
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM_EMAIL?.trim()
  );
}

export function createSmtpTransport(): Transporter {
  const config = getSmtpConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export function createSmtpEmailSender(transport: Transporter = createSmtpTransport()): EmailSender {
  const config = getSmtpConfig();

  return {
    send: async (message: EmailMessage): Promise<EmailSendResult> => {
      const options: SendMailOptions = {
        from: `${config.fromName} <${config.fromEmail}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
      };

      const info = await transport.sendMail(options);
      return {
        messageId: info.messageId || "unknown",
      };
    },
  };
}
