// Sin dependencias de servidor: lo usan la página, los componentes cliente y los tests.
export const COMMENT_STATUS_FILTERS = ["pendientes", "aprobados", "ocultos", "todos"] as const;
export type CommentStatusFilter = (typeof COMMENT_STATUS_FILTERS)[number];

export type AdminCommentQuery = {
  estado: CommentStatusFilter; // "pendientes" por defecto, no va en la URL
  articulo: string | null; // post.id; null = todos
  q: string | null; // recortado, máx. 100, null si queda vacío
  page: number; // ≥ 1
};

export const COMMENTS_PER_PAGE = 25;
export const COMMENT_QUERY_MAX = 100;
export const DEFAULT_COMMENT_STATUS: CommentStatusFilter = "pendientes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseCommentParams(
  params: Record<string, string | string[] | undefined>,
): AdminCommentQuery {
  const page = Number(first(params.page));
  const estado = first(params.estado);
  const articulo = first(params.articulo);
  return {
    estado: COMMENT_STATUS_FILTERS.find((x) => x === estado) ?? DEFAULT_COMMENT_STATUS,
    articulo: articulo && UUID.test(articulo) ? articulo : null,
    q: first(params.q)?.trim().slice(0, COMMENT_QUERY_MAX).trim() || null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

// Omite de la URL los valores por defecto.
export function commentQueryHref({ estado, articulo, q, page }: AdminCommentQuery): string {
  const params = new URLSearchParams();
  if (estado !== DEFAULT_COMMENT_STATUS) params.set("estado", estado);
  if (articulo) params.set("articulo", articulo);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/comments?${qs}` : "/admin/comments";
}
