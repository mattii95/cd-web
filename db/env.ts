import { z } from "zod";

const databaseUrl = z.url({ protocol: /^postgres(ql)?$/ });

export function getDatabaseUrl(): string {
  const parsed = databaseUrl.safeParse(process.env.DATABASE_URL);
  if (!parsed.success) {
    throw new Error(
      "DATABASE_URL falta o no es una URL postgres:// o postgresql:// válida",
    );
  }
  return parsed.data;
}
