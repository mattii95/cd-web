import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleEditor } from "@/components/admin/article-editor/article-editor";
import { EditorSkeleton } from "@/components/admin/article-editor/editor-skeleton";
import { getPostForEdit, listAllTags, listEditorCategories } from "@/db/admin-posts";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Editar artículo" };

async function EditArticle({ params }: Pick<PageProps<"/admin/articles/[id]/edit">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const [post, categories, tagOptions] = await Promise.all([
    getPostForEdit(id),
    listEditorCategories(),
    listAllTags(),
  ]);
  if (!post) notFound();
  return <ArticleEditor post={post} categories={categories} tagOptions={tagOptions} />;
}

export default function EditArticlePage(props: PageProps<"/admin/articles/[id]/edit">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditArticle params={props.params} />
    </Suspense>
  );
}
