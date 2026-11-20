// Sin dependencias de servidor: lo usan la página, los componentes cliente y los tests.
export const USER_STATUS_FILTERS = ["activos", "bloqueados", "sin-verificar"] as const;
export const USER_ROLE_FILTERS = ["lectores", "admins"] as const;

export type AdminUserQuery = {
  q: string | null; // recortado, máx. 100, null si queda vacío
  estado: (typeof USER_STATUS_FILTERS)[number] | null; // null = Todos
  rol: (typeof USER_ROLE_FILTERS)[number] | null; // null = Todos
  page: number; // ≥ 1
};

export const USERS_PER_PAGE = 25;
const Q_MAX = 100;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = <T extends string>(list: readonly T[], v: string | undefined) =>
  list.find((x) => x === v) ?? null;

export function parseUserParams(
  params: Record<string, string | string[] | undefined>,
): AdminUserQuery {
  const page = Number(first(params.page));
  return {
    q: first(params.q)?.trim().slice(0, Q_MAX).trim() || null,
    estado: oneOf(USER_STATUS_FILTERS, first(params.estado)),
    rol: oneOf(USER_ROLE_FILTERS, first(params.rol)),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

// Omite de la URL los valores por defecto.
export function userQueryHref({ q, estado, rol, page }: AdminUserQuery): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  if (rol) params.set("rol", rol);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}
