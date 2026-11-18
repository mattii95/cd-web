export const SLUG_MAX = 80;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// "¿Qué es SaaS? Guía 2026" → "que-es-saas-guia-2026". NFD separa tildes y la ñ (n + ~).
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX && SLUG_RE.test(value);
}
