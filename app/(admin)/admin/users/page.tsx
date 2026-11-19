import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getDb } from "@/db/client";
import { user } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format-date";

export const metadata: Metadata = { title: "Usuarios" };

// En móvil cada fila se apila y cada celda muestra su columna con data-label.
const cell =
  "block px-0 py-1 before:mr-2 before:font-normal before:text-cms-muted before:content-[attr(data-label)':'] md:table-cell md:px-5 md:py-3.5 md:before:content-none";

async function Users() {
  await requireAdmin();
  const users = await getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt));

  return (
    <>
      <p className="m-0 text-base text-cms-text">
        {users.length === 1
          ? "1 usuario registrado"
          : `${users.length} usuarios registrados`}
      </p>
      <section
        aria-label="Listado de usuarios"
        className="overflow-hidden rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]"
      >
        <table className="block w-full border-collapse text-left text-[15px] md:table">
          <thead className="sr-only md:not-sr-only md:table-header-group">
            <tr className="border-b border-cms-line bg-cms-head text-xs tracking-wide text-cms-text uppercase">
              {["Nombre", "Email", "Rol", "Verificado", "Alta"].map((h) => (
                <th key={h} scope="col" className="px-5 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {users.map((u) => (
              <tr
                key={u.id}
                className="block border-b border-cms-line-soft px-5 py-3 last:border-b-0 md:table-row md:px-0 md:py-0"
              >
                <td data-label="Nombre" className={`${cell} font-semibold text-cms-ink`}>
                  {u.name}
                </td>
                <td data-label="Email" className={`${cell} text-cms-text [overflow-wrap:anywhere]`}>
                  {u.email}
                </td>
                <td data-label="Rol" className={`${cell} text-cms-text`}>
                  {u.role === "admin" ? "Administrador" : "Lector"}
                </td>
                <td data-label="Verificado" className={`${cell} text-cms-text`}>
                  {u.emailVerified ? "Sí" : "No"}
                </td>
                <td data-label="Alta" className={`${cell} text-cms-muted`}>
                  {formatDate(u.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default function UsuariosPage() {
  return (
    <>
      <AdminPageHeader title="Usuarios" />
      <Suspense fallback={<p className="m-0 text-cms-text">Cargando usuarios…</p>}>
        <Users />
      </Suspense>
    </>
  );
}
