import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BlogHero, blogIntro } from "@/components/blog/blog-hero";
import { PostList } from "@/components/blog/post-list";
import { PostListSkeleton } from "@/components/blog/post-list-skeleton";
import {
  cachedCategories,
  cachedPublishedPosts,
  cachedTags,
} from "@/db/blog-cache";

export const metadata: Metadata = {
  title: "Blog",
  description: blogIntro,
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog", description: blogIntro },
};

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

async function BlogContent({
  searchParams,
}: {
  searchParams: PageProps<"/blog">["searchParams"];
}) {
  const params = await searchParams;
  await connection();
  const [categories, tags] = await Promise.all([
    cachedCategories(),
    cachedTags(),
  ]);
  // Un valor que no existe se ignora: un enlace viejo se ve como "Todos".
  const categoria = categories.find(
    (c) => c.slug === first(params.categoria),
  )?.slug;
  const etiqueta = tags.find((t) => t.slug === first(params.etiqueta))?.slug;
  const { items, nextCursor } = await cachedPublishedPosts({
    category: categoria,
    tag: etiqueta,
  });
  return (
    <PostList
      key={`${categoria ?? ""}|${etiqueta ?? ""}`}
      initialPosts={items}
      initialCursor={nextCursor}
      categories={categories}
      tags={tags}
      categoria={categoria}
      etiqueta={etiqueta}
    />
  );
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <main>
      <BlogHero />
      <Suspense fallback={<PostListSkeleton />}>
        <BlogContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
