"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import {
  createMedia,
  deleteMedia,
  listMedia,
  MediaError,
  type MediaItem,
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

type Uploaded =
  | { ok: true; message: string; item: MediaItem }
  | { ok: false; message: string };

// Lógica común de uploadMediaAction y uploadPickerMediaAction.
async function uploadFromForm(data: FormData): Promise<Uploaded> {
  const admin = await requireAdmin();
  const parsed = upload.safeParse({
    file: data.get("file"),
    alt: data.get("alt"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Elegí una imagen y escribí su texto alternativo.",
    };
  }

  const { file, alt } = parsed.data;
  try {
    const { item, duplicate } = await createMedia({
      file: Buffer.from(await file.arrayBuffer()),
      originalName: file.name.slice(0, 200),
      alt,
      uploadedBy: admin.id,
    });
    revalidatePath("/admin/media");
    return {
      ok: true,
      item,
      message: duplicate ? "Esa imagen ya estaba subida." : "Imagen subida.",
    };
  } catch (e) {
    if (e instanceof MediaError) return { ok: false, message: e.message };
    return {
      ok: false,
      message: "No pudimos subir la imagen. Intentá de nuevo en unos minutos.",
    };
  }
}

export async function uploadMediaAction(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  const r = await uploadFromForm(data);
  return r.ok ? { status: "success", message: r.message } : error(r.message);
}

// Lo único que viaja al selector: sin usage, bytes ni originalName.
export type PickerItem = {
  id: string;
  src: string; // "/media/<id>"
  alt: string; // el de Medios
  width: number;
  height: number;
};
const toPickerItem = ({
  id,
  src,
  alt,
  width,
  height,
}: MediaItem): PickerItem => ({
  id,
  src,
  alt,
  width,
  height,
});

export type PickerUploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string; item: PickerItem };

export async function uploadPickerMediaAction(
  _: PickerUploadState,
  data: FormData,
): Promise<PickerUploadState> {
  const r = await uploadFromForm(data);
  return r.ok
    ? { status: "success", message: r.message, item: toPickerItem(r.item) }
    : { status: "error", message: r.message };
}

export type PickerPage =
  | { status: "success"; items: PickerItem[]; nextCursor: string | null }
  | { status: "error"; message: string };

const searchInput = z.object({
  query: z.string().max(100),
  cursor: z.string().min(1).max(200).nullable(),
});

// Sin revalidatePath: es una lectura.
export async function searchMediaAction(input: {
  query: string;
  cursor: string | null;
}): Promise<PickerPage> {
  await requireAdmin();
  const parsed = searchInput.safeParse(input);
  if (!parsed.success) return pickerError();
  try {
    // Un cursor inválido (InvalidCursorError) cae acá igual que cualquier otro fallo.
    const { items, nextCursor } = await listMedia({
      query: parsed.data.query,
      cursor: parsed.data.cursor,
    });
    return { status: "success", items: items.map(toPickerItem), nextCursor };
  } catch {
    return pickerError();
  }
}

const pickerError = (): PickerPage => ({
  status: "error",
  message: "No pudimos cargar las imágenes.",
});

const alt = z.string().trim().min(1).max(300);

export async function updateMediaAltAction(
  _: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), alt })
    .safeParse({ id: data.get("id"), alt: data.get("alt") });
  if (!parsed.success)
    return error("El texto alternativo no puede estar vacío.");

  try {
    await updateMediaAlt(parsed.data.id, parsed.data.alt);
  } catch {
    return error(
      "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
    );
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
    return error(
      "No pudimos borrar la imagen. Intentá de nuevo en unos minutos.",
    );
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
