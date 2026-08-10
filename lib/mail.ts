import nodemailer from "nodemailer";

interface MailConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

function getMailConfig(): MailConfig {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || "";
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";
  const enabled = Boolean(user && pass);

  return {
    enabled,
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE !== "false",
    user,
    pass,
    from: process.env.EMAIL_FROM,
  };
}

export function isEmailSendingEnabled(): boolean {
  return getMailConfig().enabled;
}

export async function sendOtpEmail(
  to: string,
  code: string
): Promise<boolean> {
  const config = getMailConfig();

  if (!config.enabled || !config.user || !config.pass) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const from = config.from || `"Behrio" <${config.user}>`;

  await transporter.sendMail({
    from,
    to,
    subject: "کد تأیید Behrio",
    text: `کد تأیید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است و فقط یک بار قابل استفاده است.`,
    html: `
      <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 16px;">
        <h2 style="margin: 0 0 12px; color: #18181b; font-size: 18px;">کد تأیید Behrio</h2>
        <p style="margin: 0 0 16px; color: #52525b; font-size: 14px; line-height: 1.8;">
          کد تأیید شما برای ورود به سامانه Behrio:
        </p>
        <div style="padding: 16px; background: #f4f4f5; border-radius: 12px; text-align: center; letter-spacing: 6px; font-size: 28px; font-weight: bold; color: #18181b;">${code}</div>
        <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 12px; line-height: 1.8;">
          این کد به مدت ۵ دقیقه معتبر است و فقط یک بار قابل استفاده است. اگر شما این درخواست را ندادید، این ایمیل را نادیده بگیرید.
        </p>
      </div>
    `,
  });

  return true;
}