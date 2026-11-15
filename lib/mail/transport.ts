import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getMailEnv } from "./env";
import type { Email } from "./templates";

let transporter: Transporter | undefined;

function getTransporter() {
  if (!transporter) {
    const env = getMailEnv();
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html, text }: Email & { to: string }) {
  await getTransporter().sendMail({ from: getMailEnv().MAIL_FROM, to, subject, html, text });
}
