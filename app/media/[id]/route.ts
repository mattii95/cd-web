import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { media } from "@/db/schema";
import { readMediaFile } from "@/lib/media/storage";

const notFound = () => new Response("No encontrada", { status: 404 });

export async function GET(
  _request: Request,
  { params }: RouteContext<"/media/[id]">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const [row] = await getDb()
    .select({ id: media.id })
    .from(media)
    .where(eq(media.id, id));
  if (!row) return notFound();

  const file = await readMediaFile(id);
  if (!file) {
    console.error(`media ${id}: hay fila pero falta el archivo en MEDIA_DIR`);
    return notFound();
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      // El contenido de un id nunca cambia: editar el alt no toca el archivo.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
