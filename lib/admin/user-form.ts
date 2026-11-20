// Sin dependencias de servidor: lo usan los modales (cliente), las actions y los tests.
export const USER_FORM_LIMITS = { banReason: 300, query: 100 } as const;

export type BanFormResult =
  | { ok: true; id: string; reason: string }
  | { ok: false; fieldErrors: Partial<Record<"id" | "reason", string>> };

const str = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
};

export function parseBanForm(data: FormData): BanFormResult {
  const id = str(data, "id").trim();
  const reason = str(data, "reason").trim();
  const fieldErrors: Partial<Record<"id" | "reason", string>> = {};

  if (!id) fieldErrors.id = "Ese usuario ya no existe.";
  if (!reason) fieldErrors.reason = "Escribí el motivo del bloqueo.";
  else if (reason.length > USER_FORM_LIMITS.banReason)
    fieldErrors.reason = `El motivo puede tener hasta ${USER_FORM_LIMITS.banReason} caracteres.`;

  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, id, reason };
}

export function isDeleteConfirmed(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase();
}
