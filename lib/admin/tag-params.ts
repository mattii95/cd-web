// Sin dependencias de servidor: lo usan la página, los componentes cliente y los tests.
export type AdminTagQuery = {
  q: string | null; // recortado, máx. 100, null si queda vacío
  page: number; // ≥ 1
};

export const TAGS_PER_PAGE = 25;
const Q_MAX = 100;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseTagParams(
  params: Record<string, string | string[] | undefined>,
): AdminTagQuery {
  const page = Number(first(params.page));
  return {
    q: first(params.q)?.trim().slice(0, Q_MAX).trim() || null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

// Omite de la URL los valores por defecto.
export function tagQueryHref({ q, page }: AdminTagQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/tags?${qs}` : "/admin/tags";
}
