import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { rateLimit } from "@/db/schema";

// Better Auth solo limita su handler HTTP: las Server Actions llaman a `auth.api` directo,
// así que repiten las mismas reglas acá, en la misma tabla `rate_limit`.
const RULES = {
  "sign-in": { max: 5, window: 60 },
  "sign-up": { max: 3, window: 60 },
  "request-reset": { max: 3, window: 60 },
  "send-verification": { max: 3, window: 60 },
  "sign-in-social": { max: 10, window: 60 },
} as const;

export type RateLimitRule = keyof typeof RULES;

// Ventana fija desde el primer intento. Devuelve true si este intento pasa del máximo.
export async function hit(key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const expired = sql`${rateLimit.lastRequest} < ${now - windowSec * 1000}`;
  const [row] = await getDb()
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });
  return row.count > max;
}

export async function isRateLimited(rule: RateLimitRule): Promise<boolean> {
  const h = await headers();
  // shortcut: sin proxy que ponga la IP todos comparten el bucket "local"; configurar el header al elegir hosting.
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
  const { max, window } = RULES[rule];
  return hit(`actions|${ip}|${rule}`, max, window);
}
