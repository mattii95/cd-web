// Sin dependencias de servidor: lo usan los modales (cliente), las actions y los tests.
import { CATEGORY_ICONS, type CategoryIcon } from "@/lib/blog-posts";
import { type ServiceSlug, services } from "@/lib/services";
import { isSlug, slugify } from "@/lib/slug";

export const TAXONOMY_LIMITS = {
  categoryLabel: 40,
  tagName: 40,
  slug: 80,
} as const;

export type CategoryInput = {
  label: string;
  filterLabel: string;
  slug: string;
  serviceSlug: ServiceSlug;
  icon: CategoryIcon;
};
export type TagInput = { name: string; slug: string };

export type ParsedForm<T> =
  | { ok: true; id: string | null; input: T } // id null = crear
  | { ok: false; fieldErrors: Partial<Record<keyof T, string>> };

const str = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
};
const clean = (s: string) => s.trim().replace(/\s+/g, " ");

const SLUG_ERROR = "Usá solo minúsculas, números y guiones (máx. 80).";

export function parseCategoryForm(data: FormData): ParsedForm<CategoryInput> {
  const errors: Partial<Record<keyof CategoryInput, string>> = {};

  const label = clean(str(data, "label"));
  if (!label) errors.label = "Escribí el nombre.";
  else if (label.length > TAXONOMY_LIMITS.categoryLabel)
    errors.label = `El nombre no puede pasar de ${TAXONOMY_LIMITS.categoryLabel} caracteres.`;

  // El cliente lo autocompleta con el nombre; el servidor no lo inventa.
  const filterLabel = clean(str(data, "filterLabel"));
  if (!filterLabel) errors.filterLabel = "Escribí el texto del filtro.";
  else if (filterLabel.length > TAXONOMY_LIMITS.categoryLabel)
    errors.filterLabel = `El texto del filtro no puede pasar de ${TAXONOMY_LIMITS.categoryLabel} caracteres.`;

  const slug = str(data, "slug").trim();
  if (!isSlug(slug)) errors.slug = slug ? SLUG_ERROR : "Escribí la URL.";

  const serviceSlug = services.find((s) => s.slug === str(data, "serviceSlug"))?.slug;
  if (!serviceSlug) errors.serviceSlug = "Elegí un servicio.";

  const icon = CATEGORY_ICONS.find((i) => i === str(data, "icon"));
  if (!icon) errors.icon = "Elegí un ícono.";

  if (Object.keys(errors).length || !serviceSlug || !icon)
    return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    id: str(data, "id") || null,
    input: { label, filterLabel, slug, serviceSlug, icon },
  };
}

export function parseTagForm(data: FormData): ParsedForm<TagInput> {
  const errors: Partial<Record<keyof TagInput, string>> = {};

  const name = clean(str(data, "name"));
  if (!name) errors.name = "Escribí el nombre.";
  else if (name.length > TAXONOMY_LIMITS.tagName)
    errors.name = `El nombre no puede pasar de ${TAXONOMY_LIMITS.tagName} caracteres.`;
  else if (!slugify(name)) errors.name = "Usá al menos una letra o un número.";

  const slug = str(data, "slug").trim();
  if (!isSlug(slug)) errors.slug = slug ? SLUG_ERROR : "Escribí la URL.";

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return { ok: true, id: str(data, "id") || null, input: { name, slug } };
}
