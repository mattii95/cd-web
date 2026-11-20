"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import {
  createMedia,
  deleteMedia,
  getMediaUsage,
  listMedia,
  MediaError,
  type MediaItem,
  MediaInUseError,
  MediaNotFoundError,
  updateMedia,
} from "@/db/media";
import { parseMediaForm } from "@/lib/admin/media-form";
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

export type MediaFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<"alt" | "originalName", string>>;
    };

const GONE = "Esa imagen ya no existe.";

export async function updateMediaAction(
  _: MediaFormState,
  data: FormData,
): Promise<MediaFormState> {
  await requireAdmin();
  const parsed = parseMediaForm(data);
  if (!parsed.ok) {
    const { id, ...fieldErrors } = parsed.fieldErrors;
    return id
      ? { status: "error", message: id }
      : { status: "error", fieldErrors };
  }

  let result: Awaited<ReturnType<typeof updateMedia>>;
  try {
    result = await updateMedia(parsed.id, parsed.input);
  } catch {
    return {
      status: "error",
      message: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
    };
  }
  if (!result.ok) return { status: "error", message: GONE };

  // El alt de Medios sale en el blog cuando el nodo no tiene uno propio (SPEC 20).
  updateTag("blog");
  // Sin revalidatePath: MediaGrid actualiza su estado local.
  if (!result.altChanged) return { status: "success", message: "Cambios guardados." };

  // El cambio ya está guardado: si falla la búsqueda de uso, solo se omite el aviso.
  const usage = await getMediaUsage(parsed.id).catch(() => []);
  const titles = [...new Set(usage.map((u) => u.title))];
  return {
    status: "success",
    message: titles.length
      ? `Cambios guardados. El texto alternativo cambió en: ${titles.join(", ")}.`
      : "Cambios guardados.",
  };
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
    if (e instanceof MediaNotFoundError) return error(GONE);
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

const loadMoreInput = z.object({
  cursor: z.string().min(1).max(200),
  query: z.string().max(100), // "" = sin filtro
  usage: z.enum(["used", "unused"]).nullable(),
});

const loadError = (): LoadMoreState => ({
  status: "error",
  message: "No pudimos cargar más imágenes.",
});

// Sin revalidatePath: el cliente conserva las páginas ya cargadas.
export async function loadMoreMediaAction(input: {
  cursor: string;
  query: string;
  usage: "used" | "unused" | null;
}): Promise<LoadMoreState> {
  await requireAdmin();
  const parsed = loadMoreInput.safeParse(input);
  if (!parsed.success) return loadError();
  try {
    // Un cursor inválido (InvalidCursorError) cae acá igual que cualquier otro fallo.
    const { items, nextCursor } = await listMedia({
      cursor: parsed.data.cursor,
      query: parsed.data.query,
      usage: parsed.data.usage ?? undefined,
    });
    return { status: "success", items: items.map(toCardItem), nextCursor };
  } catch {
    return loadError();
  }
}
