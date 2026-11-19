// Sin dependencias de servidor: lo usan los modales (cliente), las actions y los tests.
export const MEDIA_FORM_LIMITS = {
  alt: 300,
  originalName: 200,
  query: 100,
} as const;

export type MediaEditInput = { alt: string; originalName: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v.trim() : "";
};

export function parseMediaForm(
  data: FormData,
):
  | { ok: true; id: string; input: MediaEditInput }
  | { ok: false; fieldErrors: Partial<Record<keyof MediaEditInput | "id", string>> } {
  const errors: Partial<Record<keyof MediaEditInput | "id", string>> = {};

  const id = str(data, "id");
  if (!UUID.test(id)) errors.id = "Esa imagen ya no existe.";

  const alt = str(data, "alt");
  if (!alt) errors.alt = "El texto alternativo no puede estar vacío.";
  else if (alt.length > MEDIA_FORM_LIMITS.alt)
    errors.alt = `El texto alternativo no puede pasar de ${MEDIA_FORM_LIMITS.alt} caracteres.`;

  const originalName = str(data, "originalName");
  if (!originalName) errors.originalName = "El nombre del archivo no puede estar vacío.";
  else if (originalName.length > MEDIA_FORM_LIMITS.originalName)
    errors.originalName = `El nombre del archivo no puede pasar de ${MEDIA_FORM_LIMITS.originalName} caracteres.`;

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return { ok: true, id, input: { alt, originalName } };
}

// Chequeo en el cliente, espejo de MEDIA_LIMITS (process.ts importa sharp).
export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
} as const;

export function checkUploadFile(file: { type: string; size: number }): string | null {
  if (!(UPLOAD_LIMITS.types as readonly string[]).includes(file.type))
    return "Formato no soportado. Subí una imagen JPEG, PNG, WebP o AVIF.";
  if (file.size > UPLOAD_LIMITS.maxBytes) return "La imagen supera el máximo de 10 MB.";
  return null;
}
