import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCta } from "@/components/blog/article-cta";
import { AuthorBox } from "@/components/blog/author-box";
import { RelatedPosts } from "@/components/blog/related-posts";
import { ArticleBody } from "@/components/blog/article-body";
import { ArticleSkeleton } from "@/components/blog/article-skeleton";
import { ReviewsSection } from "@/components/blog/reviews-section";
import { ShareButton } from "@/components/blog/share-button";
import { ArticleToc } from "@/components/blog/article-toc";
import { ArticleHero } from "@/components/blog/article-hero";
import {
  cachedApprovedComments,
  cachedPostBySlug,
  cachedRatingSummary,
} from "@/db/blog-cache";
import { formatPostDate } from "@/lib/blog-posts";

// Un slug inexistente responde 200 con noindex: notFound() ocurre durante el streaming.
export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await cachedPostBySlug((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt.toISOString(),
    },
  };
}

async function Article({
  params,
}: {
  params: PageProps<"/blog/[slug]">["params"];
}) {
  const { slug } = await params;
  await connection();
  const post = await cachedPostBySlug(slug);
  if (!post) notFound();
  const [rating, comments] = await Promise.all([
    cachedRatingSummary(post.id),
    cachedApprovedComments(post.id),
  ]);

  return (
    <>
      <ArticleHero
        post={post}
        date={formatPostDate(post.publishedAt)}
        rating={rating}
      />
      <section className="bg-paper px-6 pt-16 pb-24 text-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-14">
          <aside className="flex max-w-[300px] flex-[1_1_240px] flex-col gap-6 lg:sticky lg:top-6">
            <ArticleToc body={post.body} />
            <ShareButton title={post.title} />
          </aside>
          <div className="min-w-0 flex-[999_1_560px]">
            <div className="flex max-w-[760px] flex-col gap-6">
              <ArticleBody body={post.body} />
              <AuthorBox author={post.author} />
              <ReviewsSection
                postId={post.id}
                slug={post.slug}
                author={post.author}
                summary={rating}
                initialComments={comments.items}
                initialCursor={comments.nextCursor}
              />
              <ArticleCta post={post} />
            </div>
          </div>
        </div>
      </section>
      <Suspense>
        <RelatedPosts postId={post.id} />
      </Suspense>
    </>
  );
}

export default function ArticlePage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <main>
      <Suspense fallback={<ArticleSkeleton />}>
        <Article params={params} />
      </Suspense>
    </main>
  );
}
