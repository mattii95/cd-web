import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { listAdminComments, listCommentedPosts } from "@/db/admin-comments";
import { commentQueryHref, parseCommentParams } from "@/lib/admin/comment-params";
import { requireAdmin } from "@/lib/auth/dal";
import { CommentStatusTabs } from "./comment-status-tabs";
import { CommentsFooter } from "./comments-footer";
import { CommentsList } from "./comments-list";
import { CommentsToolbar } from "./comments-toolbar";

export const metadata: Metadata = { title: "Comentarios" };

const EMPTY = {
  pendientes: "No hay comentarios pendientes.",
  aprobados: "No hay comentarios aprobados.",
  ocultos: "No hay comentarios ocultos.",
  todos: "Todavía no hay comentarios.",
} as const;

async function Comments({ searchParams }: Pick<PageProps<"/admin/comments">, "searchParams">) {
  await requireAdmin();
  const query = parseCommentParams(await searchParams);
  const [list, posts] = await Promise.all([listAdminComments(query), listCommentedPosts()]);
  const filtering = query.articulo !== null || query.q !== null;

  return (
    <>
      <p className="m-0 text-base text-cms-text" role="status">
        {list.total === 1 ? "1 comentario" : `${list.total} comentarios`}
      </p>
      <section
        aria-label="Listado de comentarios"
        className="rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]"
      >
        <CommentStatusTabs query={query} counts={list.counts} />
        <CommentsToolbar query={query} posts={posts} />
        {list.items.length === 0 ? (
          <div className="px-6 py-16 text-center text-base text-cms-text">
            {filtering ? (
              <>
                <p className="m-0">No hay comentarios que coincidan con estos filtros.</p>
                <Link
                  href={commentQueryHref({ estado: query.estado, articulo: null, q: null, page: 1 })}
                  className="mt-3 inline-flex min-h-11 items-center font-semibold text-cms-link underline-offset-2 hover:underline"
                >
                  Limpiar filtros
                </Link>
              </>
            ) : (
              <p className="m-0">{EMPTY[query.estado]}</p>
            )}
          </div>
        ) : (
          <>
            <CommentsList
              key={commentQueryHref({ ...query, page: list.page })}
              items={list.items}
            />
            <CommentsFooter query={{ ...query, page: list.page }} list={list} />
          </>
        )}
      </section>
    </>
  );
}

function CommentsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando comentarios"
      className="divide-y divide-cms-line-soft rounded-2xl border border-cms-line bg-cms-panel"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3 px-6 py-5">
          <div className="h-8 w-48 animate-pulse rounded-full bg-cms-head motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-cms-head motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-cms-head motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

export default function ComentariosPage(props: PageProps<"/admin/comments">) {
  return (
    <>
      <AdminPageHeader
        title="Comentarios"
        description="Aprobá, ocultá o borrá lo que comentan los lectores."
      />
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
