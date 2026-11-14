import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/blog/article-body";
import { ShareButton } from "@/components/blog/share-button";
import { ArticleToc } from "@/components/blog/article-toc";
import { ArticleHero } from "@/components/blog/article-hero";
import { blogPosts, formatPostDate, getPost } from "@/lib/blog-posts";

export function generateStaticParams() {
  return blogPosts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
    },
  };
}

export default async function ArticlePage({
  params,
}: PageProps<"/blog/[slug]">) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  return (
    <main>
      <ArticleHero post={post} date={formatPostDate(post.publishedAt)} />
      <section className="bg-paper px-6 pt-16 pb-24 text-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-14">
          <aside className="flex max-w-[300px] flex-[1_1_240px] flex-col gap-6 lg:sticky lg:top-6">
            <ArticleToc body={post.body} />
            <ShareButton title={post.title} />
          </aside>
          <div className="min-w-0 flex-[999_1_560px]">
            <ArticleBody body={post.body} />
          </div>
        </div>
      </section>
    </main>
  );
}
