import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { SocialProviders } from "better-auth/social-providers";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendMail } from "@/lib/mail/transport";
import {
  existingAccountEmail,
  resetPasswordEmail,
  verificationEmail,
} from "@/lib/mail/templates";
import { getTrustedIpHeader } from "@/lib/security/env";
import { getAuthEnv } from "./env";
import { removeUnverifiedPassword } from "./link-guard";
import { assertNotSuspended } from "./suspension";
import { getSocialProvidersConfig } from "./providers";

function createAuth() {
  const env = getAuthEnv();
  const trustedIpHeader = getTrustedIpHeader();
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
    // Cast: providers.ts devuelve `object` para no acoplarse a los tipos de Better Auth.
    socialProviders: getSocialProvidersConfig() as SocialProviders,
    account: {
      // Microsoft no siempre verifica el email (nOAuth): solo Google y GitHub vinculan sin condiciones.
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
        // Por defecto Better Auth no vincula a un usuario sin verificar; el spec lo vincula y
        // borra su contraseña (databaseHooks), así que se desactiva esa exigencia.
        requireLocalEmailVerified: false,
      },
    },
    databaseHooks: {
      // Cubre email y proveedores: un bloqueado no puede crear sesión.
      session: {
        create: {
          before: async (s) => {
            await assertNotSuspended(s.userId);
          },
        },
      },
      account: {
        create: {
          // Corre antes de que Better Auth marque emailVerified = true al vincular.
          before: async (acc) => {
            if (acc.providerId !== "credential") await removeUnverifiedPassword(acc.userId);
          },
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "lector", input: false },
        bannedAt: { type: "date", required: false, input: false },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/social": { max: 10, window: 60 },
      },
    },
    // Un bot saltearía el captcha de los formularios llamando a la API HTTP. Solo cierra el router
    // HTTP: las Server Actions siguen entrando por `auth.api`.
    disabledPaths: [
      "/sign-in/email",
      "/sign-up/email",
      "/request-password-reset",
      "/send-verification-email",
    ],
    // Por defecto Better Auth solo marca Secure si BETTER_AUTH_URL es https; en producción siempre.
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      // Misma regla que getClientIp: solo el header de confianza.
      ...(trustedIpHeader && { ipAddress: { ipAddressHeaders: [trustedIpHeader] } }),
    },
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Perezoso: el build no necesita DATABASE_URL ni BETTER_AUTH_SECRET.
export function getAuth() {
  return (auth ??= createAuth());
}
