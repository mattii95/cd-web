// Sin dependencias de servidor: lo usan la página, los componentes cliente y los tests.
export const MEDIA_USAGE_FILTERS = ["en-uso", "sin-usar"] as const;
export type MediaUsageFilter = (typeof MEDIA_USAGE_FILTERS)[number];
export type AdminMediaQuery = {
  q: string | null; // recortado, máx. 100, null si queda vacío
  uso: MediaUsageFilter | null; // null = "Todas"
};

const Q_MAX = 100;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseMediaParams(
  params: Record<string, string | string[] | undefined>,
): AdminMediaQuery {
  const uso = first(params.uso);
  return {
    q: first(params.q)?.trim().slice(0, Q_MAX).trim() || null,
    uso: MEDIA_USAGE_FILTERS.find((f) => f === uso) ?? null,
  };
}

// "en-uso" / "sin-usar" de la URL → el filtro `usage` de listMedia y countMedia.
export const toUsage = (uso: MediaUsageFilter | null): "used" | "unused" | null =>
  uso === "en-uso" ? "used" : uso === "sin-usar" ? "unused" : null;

// Omite de la URL los valores por defecto.
export function mediaQueryHref({ q, uso }: AdminMediaQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (uso) params.set("uso", uso);
  const qs = params.toString();
  return qs ? `/admin/media?${qs}` : "/admin/media";
}
