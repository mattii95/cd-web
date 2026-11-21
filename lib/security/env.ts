export const TRUSTED_IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
] as const;
export type TrustedIpHeader = (typeof TRUSTED_IP_HEADERS)[number];

export type TurnstileEnv = { siteKey: string; secretKey: string };

// Claves de prueba oficiales de Cloudflare: siempre pasan.
export const TURNSTILE_TEST_KEYS: TurnstileEnv = {
  siteKey: "1x00000000000000000000AA",
  secretKey: "1x0000000000000000000000000000000AA",
};

// Perezoso, como getAuthEnv: el build no necesita las claves.
export function getTurnstileEnv(): TurnstileEnv {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (siteKey && secretKey) return { siteKey, secretKey };
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY son obligatorias en producción",
    );
  }
  return TURNSTILE_TEST_KEYS;
}

// Perezoso, como getAuthEnv: el build no necesita la variable.
export function getTrustedIpHeader(): TrustedIpHeader | undefined {
  const value = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (!value) return undefined;
  if (!(TRUSTED_IP_HEADERS as readonly string[]).includes(value)) {
    throw new Error(
      `TRUSTED_IP_HEADER debe ser uno de: ${TRUSTED_IP_HEADERS.join(", ")}`,
    );
  }
  return value as TrustedIpHeader;
}
