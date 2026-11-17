// Sin dependencias de servidor: lo usan la página, los componentes cliente y los tests.
// Los valores de la base (publicado/borrador) no salen de este archivo: la URL usa published/draft.
export type ArticleStatusParam = "published" | "draft";
export type ArticleSort = "title" | "readingTime" | "updated";
export type SortDir = "asc" | "desc";
export type UpdatedRange = "7d" | "30d" | "year";
export const PER_PAGE_OPTIONS = [10, 25, 50] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

export type AdminPostQuery = {
  status: ArticleStatusParam | null;
  q: string | null; // recortado, máx. 100, null si queda vacío
  category: string | null; // slug
  updated: UpdatedRange | null;
  sort: ArticleSort;
  dir: SortDir;
  page: number; // ≥ 1
  perPage: PerPage;
};

const STATUSES = ["published", "draft"] as const;
const SORTS = ["title", "readingTime", "updated"] as const;
const DIRS = ["asc", "desc"] as const;
const RANGES = ["7d", "30d", "year"] as const;
const Q_MAX = 100;

export const DEFAULT_QUERY: AdminPostQuery = {
  status: null,
  q: null,
  category: null,
  updated: null,
  sort: "updated",
  dir: "desc",
  page: 1,
  perPage: 25,
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(v: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((a) => a === v) ?? null;
}

export function parseArticleParams(sp: SearchParams): AdminPostQuery {
  const q = first(sp.q)?.trim().slice(0, Q_MAX).trim() || null;
  const perPage = Number(first(sp.perPage));
  const page = Number(first(sp.page));
  return {
    status: oneOf(first(sp.status), STATUSES),
    q,
    category: first(sp.category)?.trim() || null,
    updated: oneOf(first(sp.updated), RANGES),
    sort: oneOf(first(sp.sort), SORTS) ?? DEFAULT_QUERY.sort,
    dir: oneOf(first(sp.dir), DIRS) ?? DEFAULT_QUERY.dir,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    perPage: PER_PAGE_OPTIONS.find((n) => n === perPage) ?? DEFAULT_QUERY.perPage,
  };
}

// Mezcla `patch` sobre `base`, vuelve a page 1 si cambió algo distinto de `page`
// y omite de la URL los valores default.
export function articlesHref(base: AdminPostQuery, patch: Partial<AdminPostQuery>): string {
  const next = { ...base, ...patch };
  const changed = (Object.keys(patch) as (keyof AdminPostQuery)[]).some(
    (k) => k !== "page" && patch[k] !== base[k],
  );
  if (changed) next.page = 1;

  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_QUERY) as (keyof AdminPostQuery)[]) {
    if (next[key] !== DEFAULT_QUERY[key]) params.set(key, String(next[key]));
  }
  const qs = params.toString();
  return qs ? `/admin/articles?${qs}` : "/admin/articles";
}
