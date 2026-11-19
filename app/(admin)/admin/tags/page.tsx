import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { listAdminTags } from "@/db/admin-tags";
import { parseTagParams, tagQueryHref } from "@/lib/admin/tag-params";
import { requireAdmin } from "@/lib/auth/dal";
import { NewTagButton } from "./tag-dialog";
import { TagsFooter } from "./tags-footer";
import { TagsSearch } from "./tags-search";
import { TagsTable } from "./tags-table";

export const metadata: Metadata = { title: "Etiquetas" };

async function Tags({ searchParams }: Pick<PageProps<"/admin/tags">, "searchParams">) {
  await requireAdmin();
  const query = parseTagParams(await searchParams);
  const list = await listAdminTags(query);
  const searching = query.q !== null;

  return (
    <section className="rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]">
      {(searching || list.total > 0) && <TagsSearch query={query} />}
      {list.items.length === 0 ? (
        <div className="px-6 py-16 text-center text-base text-cms-text">
          {searching ? (
            <>
              <p className="m-0 [overflow-wrap:anywhere]">No hay etiquetas que coincidan con «{query.q}».</p>
              <Link
                href={tagQueryHref({ q: null, page: 1 })}
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-cms-link underline-offset-2 hover:underline"
              >
                Limpiar búsqueda
              </Link>
            </>
          ) : (
            <p className="m-0">Todavía no hay etiquetas.</p>
          )}
        </div>
      ) : (
        <>
          <TagsTable items={list.items} />
          <TagsFooter query={{ ...query, page: list.page }} list={list} />
        </>
      )}
    </section>
  );
}

export default function TagsPage(props: PageProps<"/admin/tags">) {
  return (
    <>
      <AdminPageHeader
        title="Etiquetas"
        description="Las palabras clave con las que se filtran los artículos."
        actions={<NewTagButton />}
      />
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Cargando etiquetas"
            className="h-72 animate-pulse rounded-2xl border border-cms-line bg-cms-panel motion-reduce:animate-none"
          />
        }
      >
        <Tags searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
