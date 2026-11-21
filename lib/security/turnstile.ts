import { getTurnstileEnv } from "./env";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = { success: boolean; "error-codes"?: string[] };

// Falla cerrado: ante cualquier duda (token vacío, red, timeout, status) devuelve false.
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  const { secretKey } = getTurnstileEnv();
  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (ip !== "local") body.set("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (res.status !== 200) return false;
    const data = (await res.json()) as SiteverifyResponse;
    return data.success === true;
  } catch (e) {
    console.error("Turnstile siteverify falló", e);
    return false;
  }
}
