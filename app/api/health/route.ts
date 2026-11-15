import { connection } from "next/server";
import { checkDatabase } from "@/db/health";

export async function GET() {
  // Sin esto, con cacheComponents el build intentaría prerenderizar la ruta y consultar la base.
  await connection();
  const { ok } = await checkDatabase();
  return Response.json(
    { status: ok ? "ok" : "error", db: ok ? "up" : "down" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
