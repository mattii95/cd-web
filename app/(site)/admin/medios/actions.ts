"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/cuenta/actions";
import { createMedia, MediaError } from "@/db/media";
import { requireAdmin } from "@/lib/auth/dal";

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
    revalidatePath("/admin/medios");
    return {
      status: "success",
      message: duplicate ? "Esa imagen ya estaba subida." : "Imagen subida.",
    };
  } catch (e) {
    if (e instanceof MediaError) return error(e.message);
    return error("No pudimos subir la imagen. Intentá de nuevo en unos minutos.");
  }
}
