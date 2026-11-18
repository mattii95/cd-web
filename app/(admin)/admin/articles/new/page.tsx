import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleEditor } from "@/components/admin/article-editor/article-editor";
import { EditorSkeleton } from "@/components/admin/article-editor/editor-skeleton";
import { listAllTags, listEditorCategories } from "@/db/admin-posts";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Nuevo artículo" };

async function NewArticle() {
  await requireAdmin();
  const [categories, tagOptions] = await Promise.all([listEditorCategories(), listAllTags()]);
  return <ArticleEditor post={null} categories={categories} tagOptions={tagOptions} />;
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewArticle />
    </Suspense>
  );
}
