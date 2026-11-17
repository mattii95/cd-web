import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { countMedia, listMedia } from "@/db/media";
import { requireAdmin } from "@/lib/auth/dal";
import { toCardItem } from "./card-item";
import { MediaGrid } from "./media-grid";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Medios" };

async function Library() {
  await requireAdmin();
  const [{ items, nextCursor }, total] = await Promise.all([
    listMedia(),
    countMedia(),
  ]);
  // Una imagen nueva cambia el primer id y reinicia la grilla a la primera página.
  const key = items.map((i) => i.id).join(",");
  return (
    <>
      <UploadForm />
      <MediaGrid
        key={key}
        initialItems={items.map(toCardItem)}
        initialCursor={nextCursor}
        initialTotal={total}
      />
    </>
  );
}

export default function MediosPage() {
  return (
    <>
      <AdminPageHeader
        title="Medios"
        description="Subí y organizá las imágenes del blog."
      />
      <Suspense fallback={<p className="m-0 text-cms-text">Cargando medios…</p>}>
        <Library />
      </Suspense>
    </>
  );
}
