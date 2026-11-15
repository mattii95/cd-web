import { z } from "zod";

export type SocialProvider = "google" | "github" | "microsoft";

// Orden fijo: define también el orden de los botones.
const PROVIDERS: SocialProvider[] = ["google", "github", "microsoft"];

const credentials = z.object({
  id: z.string().optional(),
  secret: z.string().optional(),
});

// Valida al llamar, no al importar: el build no necesita estas variables.
function readCredentials(provider: SocialProvider) {
  const prefix = provider.toUpperCase();
  const idKey = `${prefix}_CLIENT_ID`;
  const secretKey = `${prefix}_CLIENT_SECRET`;
  const { id, secret } = credentials.parse({
    id: process.env[idKey] || undefined,
    secret: process.env[secretKey] || undefined,
  });
  if (!id && !secret) return null;
  if (!id || !secret) {
    throw new Error(
      `${id ? secretKey : idKey} falta: ${provider} necesita ${idKey} y ${secretKey}`,
    );
  }
  return { clientId: id, clientSecret: secret };
}

export function getEnabledProviders(): SocialProvider[] {
  return PROVIDERS.filter((p) => readCredentials(p));
}

export function getSocialProvidersConfig(): Partial<
  Record<SocialProvider, object>
> {
  const config: Partial<Record<SocialProvider, object>> = {};
  for (const provider of PROVIDERS) {
    const creds = readCredentials(provider);
    if (!creds) continue;
    config[provider] =
      provider === "microsoft"
        ? { ...creds, tenantId: "common", disableProfilePhoto: true }
        : creds;
  }
  return config;
}
