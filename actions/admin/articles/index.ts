"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/actions/cuenta";
import { deletePost, setPostStatus } from "@/db/admin-posts";
import { requireAdmin } from "@/lib/auth/dal";

const error = (message: string): FormState => ({ status: "error", message });

const MSG = {
  gone: "Ese artículo ya no existe.",
  db: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
};

// Un artículo que cambia de estado o se borra sale del blog público: se invalidan las dos cachés.
function invalidate(slug: string) {
  updateTag("blog");
  updateTag(`post:${slug}`);
  revalidatePath("/admin/articles");
}

async function run(
  data: FormData,
  op: (id: string) => Promise<{ slug: string; changed?: boolean } | null>,
  done: string,
): Promise<FormState> {
  await requireAdmin();
  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) return error(MSG.gone);

  try {
    const res = await op(id.data);
    if (!res) return error(MSG.gone);
    // Sin cambio (otra pestaña ya lo hizo): éxito sin invalidar nada.
    if (res.changed !== false) invalidate(res.slug);
    return { status: "success", message: done };
  } catch {
    return error(MSG.db);
  }
}

export async function publishPostAction(_: FormState, data: FormData): Promise<FormState> {
  return run(data, (id) => setPostStatus(id, "publicado"), "Artículo publicado.");
}

export async function unpublishPostAction(_: FormState, data: FormData): Promise<FormState> {
  return run(data, (id) => setPostStatus(id, "borrador"), "Artículo pasado a borrador.");
}

export async function deletePostAction(_: FormState, data: FormData): Promise<FormState> {
  return run(data, deletePost, "Artículo eliminado.");
}
