import { z } from "zod";

export type Page<T> = { items: T[]; nextCursor: string | null };
export type PageParams = { limit?: number; cursor?: string | null };

export class InvalidCursorError extends Error {
  constructor(message = "Cursor inválido") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

const cursorSchema = z.strictObject({
  t: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/),
  id: z.uuid(),
});

export type CursorData = z.infer<typeof cursorSchema>;

export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify({ t: data.t, id: data.id })).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string): CursorData {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  const parsed = cursorSchema.safeParse(json);
  if (!parsed.success) throw new InvalidCursorError();
  return parsed.data;
}

export function resolveLimit(
  limit: number | undefined,
  defaultLimit: number,
): number {
  if (limit === undefined) return defaultLimit;
  if (!Number.isFinite(limit)) return defaultLimit;
  return Math.min(100, Math.max(1, Math.trunc(limit)));
}
