import { z } from "zod";

const authEnv = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

export function getAuthEnv() {
  const parsed = authEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "BETTER_AUTH_SECRET (32 caracteres o más) o BETTER_AUTH_URL faltan o no son válidos",
    );
  }
  return parsed.data;
}
