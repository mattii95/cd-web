import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { listAdminUsers } from "@/db/admin-users";
import { parseUserParams } from "@/lib/admin/user-params";
import { requireAdmin } from "@/lib/auth/dal";
import { UsersFooter } from "./users-footer";
import { UsersTable } from "./users-table";
import { UsersToolbar } from "./users-toolbar";

export const metadata: Metadata = { title: "Usuarios" };

async function Users({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const admin = await requireAdmin();
  const query = parseUserParams(await searchParams);
  const list = await listAdminUsers(query);
  const filtering = query.q !== null || query.estado !== null || query.rol !== null;

  return (
    <>
      <p className="m-0 text-base text-cms-text" role="status">
        {list.total === 1 ? "1 usuario" : `${list.total} usuarios`}
      </p>
      <section
        aria-label="Listado de usuarios"
        className="rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]"
      >
        {(filtering || list.total > 0) && <UsersToolbar query={query} />}
        {list.items.length === 0 ? (
          <div className="px-6 py-16 text-center text-base text-cms-text">
            {filtering ? (
              <>
                <p className="m-0">No hay usuarios que coincidan con estos filtros.</p>
                <Link
                  href="/admin/users"
                  className="mt-3 inline-flex min-h-11 items-center font-semibold text-cms-link underline-offset-2 hover:underline"
                >
                  Limpiar filtros
                </Link>
              </>
            ) : (
              <p className="m-0">Todavía no hay usuarios.</p>
            )}
          </div>
        ) : (
          <>
            <UsersTable items={list.items} currentUserId={admin.id} />
            <UsersFooter query={{ ...query, page: list.page }} list={list} />
          </>
        )}
      </section>
    </>
  );
}

export default function UsuariosPage(props: PageProps<"/admin/users">) {
  return (
    <>
      <AdminPageHeader title="Usuarios" />
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Cargando usuarios"
            className="h-72 animate-pulse rounded-2xl border border-cms-line bg-cms-panel motion-reduce:animate-none"
          />
        }
      >
        <Users searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
