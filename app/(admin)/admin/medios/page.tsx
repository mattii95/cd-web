import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { countMedia, listMedia } from "@/db/media";
import { requireAdmin } from "@/lib/auth/dal";
import { toCardItem } from "./card-item";
import { MediaGrid } from "./media-grid";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "Medios",
  robots: { index: false, follow: false },
};

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
    <main className="bg-background text-white">
      {/* pt: 92px de header (absoluto) + 56px de aire */}
      <div className="mx-auto min-h-[70vh] max-w-[1100px] px-6 pt-[148px] pb-24">
        <Link
          href="/admin"
          className="text-sm text-text-muted no-underline hover:text-white"
        >
          Administración
        </Link>
        <h1 className="m-0 mt-2 font-display text-[clamp(32px,4.4vw,52px)] leading-[1.04] font-bold tracking-[-0.025em]">
          Medios
        </h1>
        <Suspense
          fallback={<p className="m-0 mt-3 text-text-muted">Cargando medios…</p>}
        >
          <Library />
        </Suspense>
      </div>
    </main>
  );
}
