import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";

export class MediaError extends Error {}

export const MEDIA_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxWidth: 1920,
  formats: ["jpeg", "png", "webp", "avif"],
  webpQuality: 82,
} as const;

const UNSUPPORTED =
  "Formato no soportado. Subí una imagen JPEG, PNG, WebP o AVIF.";

export async function processImage(input: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
  sha256: string;
}> {
  if (input.length > MEDIA_LIMITS.maxBytes) {
    throw new MediaError("La imagen supera el máximo de 10 MB.");
  }

  // El formato se detecta por contenido, no por extensión.
  let meta: Metadata;
  try {
    // Sin límite aquí: sharp lanzaría un error genérico antes de poder medir los píxeles.
    meta = await sharp(input).metadata();
  } catch {
    throw new MediaError(UNSUPPORTED);
  }
  if (!meta.format || !(MEDIA_LIMITS.formats as readonly string[]).includes(meta.format)) {
    throw new MediaError(UNSUPPORTED);
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > MEDIA_LIMITS.maxPixels) {
    throw new MediaError("La imagen supera los 40 megapíxeles.");
  }

  try {
    // rotate() aplica la orientación EXIF; sharp descarta los metadatos al salir.
    const { data, info } = await sharp(input, { limitInputPixels: MEDIA_LIMITS.maxPixels })
      .rotate()
      .resize({ width: MEDIA_LIMITS.maxWidth, withoutEnlargement: true })
      .webp({ quality: MEDIA_LIMITS.webpQuality })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      sha256: createHash("sha256").update(input).digest("hex"),
    };
  } catch {
    throw new MediaError("No se pudo procesar la imagen.");
  }
}
