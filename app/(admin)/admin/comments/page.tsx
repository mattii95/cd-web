import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Comentarios" };

async function Comments() {
  await requireAdmin();
  return null; // La lista llega en el paso 5.
}

export default function ComentariosPage() {
  return (
    <>
      <AdminPageHeader
        title="Comentarios"
        description="Aprobá, ocultá o borrá lo que comentan los lectores."
      />
      <Suspense fallback={null}>
        <Comments />
      </Suspense>
    </>
  );
}
