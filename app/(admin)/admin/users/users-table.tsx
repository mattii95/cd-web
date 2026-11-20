import type { AdminUserRow, UserStatus } from "@/db/admin-users";
import { UserAvatar } from "@/components/auth/user-avatar";
import { avatarSrc } from "@/lib/auth/avatar";
import { formatDate } from "@/lib/format-date";
import { LoginMethodIcons } from "./login-method-icons";
import { UserRowMenu } from "./user-row-menu";

// En móvil cada fila se apila y cada celda muestra su columna con data-label.
const cell =
  "block px-0 py-1 before:mr-2 before:font-normal before:text-cms-muted before:content-[attr(data-label)':'] md:table-cell md:px-4 md:py-3.5 md:align-middle md:before:content-none";

const BADGE: Record<UserStatus, { label: string; className: string }> = {
  activo: { label: "Activo", className: "bg-green-100 text-green-900" },
  "sin-verificar": { label: "Sin verificar", className: "bg-amber-100 text-amber-900" },
  bloqueado: { label: "Bloqueado", className: "bg-red-100 text-red-900" },
};

const th = "px-4 py-3 font-semibold uppercase";

export function UsersTable({ items, currentUserId }: { items: AdminUserRow[]; currentUserId: string }) {
  return (
    <table aria-label="Listado de usuarios" className="block w-full border-collapse text-left text-[15px] md:table">
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="border-b border-cms-line bg-cms-head text-xs tracking-wide text-cms-text">
          <th scope="col" className={th}>Usuario</th>
          <th scope="col" className={th}>Rol</th>
          <th scope="col" className={th}>Estado</th>
          <th scope="col" className={th}>Acceso</th>
          <th scope="col" className={th}>Última actividad</th>
          <th scope="col" className={th}>Alta</th>
          <th scope="col" className={th}>Más acciones</th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {items.map((u) => {
          const badge = BADGE[u.status];
          const isSelf = u.id === currentUserId;
          return (
            <tr
              key={u.id}
              className="block border-b border-cms-line-soft px-5 py-3 last:border-b-0 md:table-row md:px-0 md:py-0"
            >
              <td data-label="Usuario" className={`${cell} min-w-0 md:min-w-64`}>
                <span className="inline-flex max-w-full items-center gap-3 align-middle">
                  <span
                    aria-hidden="true"
                    className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-full bg-cms-chip text-sm font-bold text-cms-ink"
                  >
                    <UserAvatar name={u.name} image={avatarSrc(u.image)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-cms-ink [overflow-wrap:break-word]">
                      {u.name}
                      {isSelf && <span className="ml-1 font-normal text-cms-muted">(vos)</span>}
                    </span>
                    <span className="block text-sm text-cms-text [overflow-wrap:break-word]">{u.email}</span>
                  </span>
                </span>
              </td>
              <td data-label="Rol" className={`${cell} text-cms-text md:whitespace-nowrap`}>
                {u.role === "admin" ? "Administrador" : "Lector"}
              </td>
              <td data-label="Estado" className={cell}>
                <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
                {u.bannedAt && (
                  <span className="mt-1 block text-sm text-cms-muted">desde {formatDate(u.bannedAt)}</span>
                )}
              </td>
              <td data-label="Acceso" className={cell}>
                <LoginMethodIcons methods={u.methods} />
              </td>
              <td data-label="Última actividad" className={`${cell} text-cms-text`}>
                {u.lastActiveAt ? formatDate(u.lastActiveAt) : "Sin sesiones"}
              </td>
              <td data-label="Alta" className={`${cell} text-cms-muted`}>
                {formatDate(u.createdAt)}
              </td>
              <td data-label="Más acciones" className={cell}>
                <UserRowMenu user={u} isSelf={isSelf} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
