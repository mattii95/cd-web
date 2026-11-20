"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/icons";
import { USER_FORM_LIMITS } from "@/lib/admin/user-form";
import {
  type AdminUserQuery,
  USER_ROLE_FILTERS,
  USER_STATUS_FILTERS,
  userQueryHref,
} from "@/lib/admin/user-params";

const STATUS_LABEL: Record<(typeof USER_STATUS_FILTERS)[number], string> = {
  activos: "Activos",
  bloqueados: "Bloqueados",
  "sin-verificar": "Sin verificar",
};
const ROLE_LABEL: Record<(typeof USER_ROLE_FILTERS)[number], string> = {
  lectores: "Lectores",
  admins: "Administradores",
};

const control = "min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel text-sm text-cms-ink";
const label = "text-xs font-semibold text-cms-text";

export function UsersToolbar({ query }: { query: AdminUserQuery }) {
  const router = useRouter();
  const [text, setText] = useState(query.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typing = useRef(false); // hay una búsqueda escrita que todavía no llegó a la URL
  useEffect(() => () => clearTimeout(timer.current), []);

  // "Limpiar filtros" (un enlace) vacía la URL: el campo la sigue, salvo que se esté escribiendo.
  useEffect(() => {
    if (query.q === null && !typing.current) setText("");
  }, [query.q]);

  // Cada búsqueda o filtro nuevo vuelve a la página 1.
  const go = (next: Partial<AdminUserQuery>) =>
    router.replace(userQueryHref({ ...query, ...next, page: 1 }), { scroll: false });

  return (
    <div className="grid gap-3 border-b border-cms-line bg-cms-panel-alt px-4 py-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
      <div className="flex flex-col gap-1">
        <label htmlFor="user-search" className={label}>
          Buscar por nombre o email
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-cms-muted" />
          <input
            id="user-search"
            type="search"
            value={text}
            maxLength={USER_FORM_LIMITS.query}
            placeholder="Ana, ana@correo.com"
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              clearTimeout(timer.current);
              typing.current = true;
              timer.current = setTimeout(() => {
                typing.current = false;
                go({ q: value.trim() || null });
              }, 300);
            }}
            className={`${control} pr-3 pl-10`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="user-status" className={label}>
          Estado
        </label>
        <select
          id="user-status"
          value={query.estado ?? ""}
          onChange={(e) =>
            go({ estado: USER_STATUS_FILTERS.find((s) => s === e.target.value) ?? null })
          }
          className={`${control} px-3`}
        >
          <option value="">Todos</option>
          {USER_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="user-role" className={label}>
          Rol
        </label>
        <select
          id="user-role"
          value={query.rol ?? ""}
          onChange={(e) => go({ rol: USER_ROLE_FILTERS.find((r) => r === e.target.value) ?? null })}
          className={`${control} px-3`}
        >
          <option value="">Todos</option>
          {USER_ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
