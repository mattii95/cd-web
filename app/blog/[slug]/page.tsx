import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
    </main>
  );
}
