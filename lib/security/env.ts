export const TRUSTED_IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
] as const;
export type TrustedIpHeader = (typeof TRUSTED_IP_HEADERS)[number];

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
