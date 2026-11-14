import type { Metadata } from "next";
import { BlogHero, blogIntro } from "@/components/blog/blog-hero";

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
    </main>
  );
}
