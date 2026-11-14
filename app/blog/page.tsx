import type { Metadata } from "next";
import { BlogHero, blogIntro } from "@/components/blog/blog-hero";
import { PostList } from "@/components/blog/post-list";
import { blogPosts, formatPostDate } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog",
  description: blogIntro,
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog", description: blogIntro },
};

export default function BlogPage() {
  return (
    <main>
      <BlogHero />
      <PostList
        posts={blogPosts}
        featuredDate={formatPostDate(blogPosts[0].publishedAt)}
      />
    </main>
  );
}
