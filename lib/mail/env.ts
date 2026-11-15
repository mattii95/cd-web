import { z } from "zod";

const mailEnv = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(1),
});

export function getMailEnv() {
  const parsed = mailEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "SMTP_HOST, SMTP_PORT o MAIL_FROM faltan o no son válidos",
    );
  }
  return parsed.data;
}
