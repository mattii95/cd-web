import { getTrustedIpHeader } from "./env";

let warned = false;

// Solo confía en el header que nombra TRUSTED_IP_HEADER; el cliente puede falsificar los demás.
export function getClientIp(headers: Headers): string {
  const name = getTrustedIpHeader();
  if (!name) {
    if (process.env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn(
        "TRUSTED_IP_HEADER no está configurado: el rate limit por IP comparte un único bucket",
      );
    }
    return "local";
  }
  const value = headers.get(name);
  if (!value) return "local";
  // En x-forwarded-for el último valor es el que agregó el proxy propio; el primero lo controla el cliente.
  return name === "x-forwarded-for" ? value.split(",").pop()!.trim() || "local" : value.trim();
}
