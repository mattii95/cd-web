import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Etiquetas" };

async function Tags() {
  await requireAdmin();
  return null; // La tabla llega en el paso 8 del SPEC 21.
}

export default function TagsPage() {
  return (
    <>
      <AdminPageHeader title="Etiquetas" description="Las palabras clave con las que se filtran los artículos." />
      <Suspense fallback={null}>
        <Tags />
      </Suspense>
    </>
  );
}
