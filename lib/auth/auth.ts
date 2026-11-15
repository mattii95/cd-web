import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendMail } from "@/lib/mail/transport";
import {
  existingAccountEmail,
  resetPasswordEmail,
  verificationEmail,
} from "@/lib/mail/templates";
import { getAuthEnv } from "./env";

function createAuth() {
  const env = getAuthEnv();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      // Con requireEmailVerification, Better Auth no revela duplicados: avisamos a la cuenta existente.
      onExistingUserSignUp: async ({ user }) =>
        sendMail({
          to: user.email,
          ...existingAccountEmail(user.name, `${env.BETTER_AUTH_URL}/cuenta/login`),
        }),
      sendResetPassword: async ({ user, url }) =>
        sendMail({ to: user.email, ...resetPasswordEmail(user.name, url) }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 86400,
      sendVerificationEmail: async ({ user, url }) =>
        sendMail({ to: user.email, ...verificationEmail(user.name, url) }),
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "lector", input: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { max: 5, window: 60 },
        "/sign-up/email": { max: 3, window: 60 },
        "/request-password-reset": { max: 3, window: 60 },
        "/send-verification-email": { max: 3, window: 60 },
      },
    },
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Perezoso: el build no necesita DATABASE_URL ni BETTER_AUTH_SECRET.
export function getAuth() {
  return (auth ??= createAuth());
}
