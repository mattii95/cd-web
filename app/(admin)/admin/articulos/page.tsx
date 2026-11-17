import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Artículos" };

async function Empty() {
  await requireAdmin();
  return (
    <section className="rounded-2xl border border-cms-line bg-cms-panel px-6 py-16 text-center shadow-[0_8px_24px_rgba(11,16,32,0.08)]">
      <p className="m-0 text-base text-cms-text">
        La gestión de artículos llega en el próximo spec.
      </p>
    </section>
  );
}

export default function ArticulosPage() {
  return (
    <>
      <AdminPageHeader
        title="Artículos"
        description="Creá, editá y publicá las notas del blog."
      />
      <Suspense fallback={null}>
        <Empty />
      </Suspense>
    </>
  );
}
