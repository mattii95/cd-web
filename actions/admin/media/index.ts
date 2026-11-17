"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import {
  createMedia,
  deleteMedia,
  listMedia,
  MediaError,
  MediaInUseError,
  updateMediaAlt,
} from "@/db/media";
import { requireAdmin } from "@/lib/auth/dal";
import { type CardItem, toCardItem } from "@/app/(admin)/admin/media/card-item";

const error = (message: string): FormState => ({ status: "error", message });

const upload = z.object({
  file: z.instanceof(File).refine((f) => f.size > 0),
  alt: z.string().trim().min(1).max(300),
});

export async function uploadMediaAction(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = upload.safeParse({ file: data.get("file"), alt: data.get("alt") });
  if (!parsed.success) {
    return error("Elegí una imagen y escribí su texto alternativo.");
  }

  const { file, alt } = parsed.data;
  try {
    const { duplicate } = await createMedia({
      file: Buffer.from(await file.arrayBuffer()),
      originalName: file.name.slice(0, 200),
      alt,
      uploadedBy: admin.id,
    });
    revalidatePath("/admin/media");
    return {
      status: "success",
      message: duplicate ? "Esa imagen ya estaba subida." : "Imagen subida.",
    };
  } catch (e) {
    if (e instanceof MediaError) return error(e.message);
    return error("No pudimos subir la imagen. Intentá de nuevo en unos minutos.");
  }
}

const alt = z.string().trim().min(1).max(300);

export async function updateMediaAltAction(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), alt })
    .safeParse({ id: data.get("id"), alt: data.get("alt") });
  if (!parsed.success) return error("El texto alternativo no puede estar vacío.");

  try {
    await updateMediaAlt(parsed.data.id, parsed.data.alt);
  } catch {
    return error("No pudimos guardar el cambio. Intentá de nuevo en unos minutos.");
  }
  // Sin revalidatePath: MediaGrid actualiza su estado local.
  return { status: "success", message: "Texto alternativo guardado." };
}

export async function deleteMediaAction(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = z.uuid().safeParse(data.get("id"));
  if (!parsed.success) return error("No encontramos la imagen.");

  try {
    await deleteMedia(parsed.data);
  } catch (e) {
    if (e instanceof MediaInUseError) {
      const titles = [...new Set(e.usage.map((u) => u.title))].join(", ");
      return error(`No se puede borrar: está en uso en ${titles}.`);
    }
    return error("No pudimos borrar la imagen. Intentá de nuevo en unos minutos.");
  }
  // Sin revalidatePath: MediaGrid saca la tarjeta de su estado local.
  return { status: "success", message: "Imagen borrada." };
}

export type LoadMoreState =
  | { status: "success"; items: CardItem[]; nextCursor: string | null }
  | { status: "error"; message: string };

const cursorSchema = z.string().min(1).max(200);

const loadError = (): LoadMoreState => ({
  status: "error",
  message: "No pudimos cargar más imágenes.",
});

// Sin revalidatePath: el cliente conserva las páginas ya cargadas.
export async function loadMoreMediaAction(
  cursor: string,
): Promise<LoadMoreState> {
  await requireAdmin();
  const parsed = cursorSchema.safeParse(cursor);
  if (!parsed.success) return loadError();
  try {
    // Un cursor inválido (InvalidCursorError) cae acá igual que cualquier otro fallo.
    const { items, nextCursor } = await listMedia({ cursor: parsed.data });
    return { status: "success", items: items.map(toCardItem), nextCursor };
  } catch {
    return loadError();
  }
}
