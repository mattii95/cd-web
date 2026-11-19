import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { listAdminCategories } from "@/db/admin-categories";
import { requireAdmin } from "@/lib/auth/dal";
import { NewCategoryButton } from "./category-dialog";
import { CategoriesTable } from "./categories-table";

export const metadata: Metadata = { title: "Categorías" };

async function Categories() {
  await requireAdmin();
  const items = await listAdminCategories();

  return (
    <section className="rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]">
      {items.length === 0 ? (
        <p className="m-0 px-6 py-16 text-center text-base text-cms-text">Todavía no hay categorías.</p>
      ) : (
        <CategoriesTable items={items} />
      )}
    </section>
  );
}

export default function CategoriesPage() {
  return (
    <>
      <AdminPageHeader
        title="Categorías"
        description="Agrupan los artículos del blog y definen los filtros públicos."
        actions={<NewCategoryButton />}
      />
      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Cargando categorías"
            className="h-72 animate-pulse rounded-2xl border border-cms-line bg-cms-panel motion-reduce:animate-none"
          />
        }
      >
        <Categories />
      </Suspense>
    </>
  );
}
