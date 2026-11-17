import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { listAdminPosts } from "@/db/admin-posts";
import { getCategories } from "@/db/blog";
import { articlesHref, parseArticleParams } from "@/lib/admin/article-params";
import { requireAdmin } from "@/lib/auth/dal";
import { ArticleFilters } from "./article-filters";
import { ArticlesFooter } from "./articles-footer";
import { ArticlesTable } from "./articles-table";
import { StatusTabs } from "./status-tabs";

export const metadata: Metadata = { title: "Artículos" };

async function Articles({ searchParams }: Pick<PageProps<"/admin/articles">, "searchParams">) {
  await requireAdmin();
  const query = parseArticleParams(await searchParams);
  const [list, categories] = await Promise.all([listAdminPosts(query), getCategories()]);

  return (
    <section className="rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]">
      <StatusTabs query={query} counts={list.counts} />
      <ArticleFilters query={query} categories={categories} />
      {list.items.length === 0 ? (
        <div className="px-6 py-16 text-center text-base text-cms-text">
          {list.counts.all === 0 ? (
            <p className="m-0">Todavía no hay artículos.</p>
          ) : (
            <>
              <p className="m-0">Ningún artículo coincide con los filtros.</p>
              <Link
                href={articlesHref(query, { q: null, category: null, updated: null })}
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-cms-link underline-offset-2 hover:underline"
              >
                Limpiar filtros
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <ArticlesTable query={query} items={list.items} />
          <ArticlesFooter query={{ ...query, page: list.page }} list={list} />
        </>
      )}
    </section>
  );
}

export default function ArticlesPage(props: PageProps<"/admin/articles">) {
  return (
    <>
      <AdminPageHeader title="Artículos" description="Creá, editá y publicá las notas del blog." />
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Cargando artículos"
            className="h-96 animate-pulse rounded-2xl border border-cms-line bg-cms-panel motion-reduce:animate-none"
          />
        }
      >
        <Articles searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
