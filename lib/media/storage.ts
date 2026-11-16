import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const mediaEnv = z.object({
  MEDIA_DIR: z.string().trim().min(1).default("storage/media"),
});

// Única puerta a MEDIA_DIR: nadie más arma rutas al disco.
export async function getMediaDir(): Promise<string> {
  const parsed = mediaEnv.safeParse({
    MEDIA_DIR: process.env.MEDIA_DIR || undefined,
  });
  if (!parsed.success) throw new Error("MEDIA_DIR no es una ruta válida");
  const dir = path.resolve(process.cwd(), parsed.data.MEDIA_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

// El id llega de la URL pública: solo se aceptan UUID, nunca rutas.
async function filePath(id: string): Promise<string> {
  if (!z.uuid().safeParse(id).success) throw new Error("id de media inválido");
  return path.join(await getMediaDir(), `${id}.webp`);
}

export async function writeMediaFile(id: string, data: Buffer): Promise<void> {
  await writeFile(await filePath(id), data);
}

// null si el archivo no existe.
export async function readMediaFile(id: string): Promise<Buffer | null> {
  try {
    return await readFile(await filePath(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// Si el archivo no está, no falla.
export async function deleteMediaFile(id: string): Promise<void> {
  await rm(await filePath(id), { force: true });
}
