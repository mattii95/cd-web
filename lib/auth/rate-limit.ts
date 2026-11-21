import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { rateLimit } from "@/db/schema";
import { getClientIp } from "@/lib/security/client-ip";

// Better Auth solo limita su handler HTTP: las Server Actions llaman a `auth.api` directo,
// así que repiten las mismas reglas acá, en la misma tabla `rate_limit`.
const RULES = {
  "sign-in": { max: 5, window: 60 },
  "sign-up": { max: 3, window: 60 },
  "request-reset": { max: 3, window: 60 },
  "send-verification": { max: 3, window: 60 },
  "sign-in-social": { max: 10, window: 60 },
  comment: { max: 5, window: 600 },
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
  const { max, window } = RULES[rule];
  return hit(`actions|${getClientIp(h)}|${rule}`, max, window);
}

// Por usuario, no por IP: sin proxy configurado todos comparten el bucket "local".
export async function isUserRateLimited(rule: RateLimitRule, userId: string): Promise<boolean> {
  const { max, window } = RULES[rule];
  return hit(`actions|user:${userId}|${rule}`, max, window);
}
