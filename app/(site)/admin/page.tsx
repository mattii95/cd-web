import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { user } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format-date";

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};

// En móvil cada fila se apila y cada celda muestra su columna con data-label.
const cell =
  "block px-0 py-1 before:mr-2 before:font-normal before:text-text-subtle before:content-[attr(data-label)':'] md:table-cell md:px-5 md:py-3.5 md:before:content-none";

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
      <p className="m-0 mt-3 text-base text-text-muted">
        {users.length === 1
          ? "1 usuario registrado"
          : `${users.length} usuarios registrados`}
      </p>
      <table className="mt-10 block w-full border-collapse text-left text-[15px] md:table">
        <thead className="sr-only md:not-sr-only md:table-header-group">
          <tr className="border-b border-border-strong text-sm text-text-subtle">
            {["Nombre", "Email", "Rol", "Verificado", "Alta"].map((h) => (
              <th key={h} scope="col" className="px-5 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {users.map((u) => (
            <tr
              key={u.id}
              className="block border-b border-border-muted py-3 md:table-row md:py-0"
            >
              <td data-label="Nombre" className={`${cell} font-semibold text-text-strong`}>
                {u.name}
              </td>
              <td data-label="Email" className={`${cell} text-text [overflow-wrap:anywhere]`}>
                {u.email}
              </td>
              <td data-label="Rol" className={`${cell} text-text`}>
                {u.role === "admin" ? "Administrador" : "Lector"}
              </td>
              <td data-label="Verificado" className={`${cell} text-text`}>
                {u.emailVerified ? "Sí" : "No"}
              </td>
              <td data-label="Alta" className={`${cell} text-text-muted`}>
                {formatDate(u.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="bg-background text-white">
      {/* pt: 92px de header (absoluto) + 56px de aire */}
      <div className="mx-auto min-h-[70vh] max-w-[1000px] px-6 pt-[148px] pb-24">
        <h1 className="m-0 font-display text-[clamp(32px,4.4vw,52px)] leading-[1.04] font-bold tracking-[-0.025em]">
          Administración
        </h1>
        <Suspense fallback={<p className="m-0 mt-3 text-text-muted">Cargando usuarios…</p>}>
          <Users />
        </Suspense>
      </div>
    </main>
  );
}
