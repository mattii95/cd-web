import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listMedia } from "@/db/media";
import { requireAdmin } from "@/lib/auth/dal";
import { toCardItem } from "./card-item";
import { MediaCard } from "./media-card";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "Medios",
  robots: { index: false, follow: false },
};

async function Library() {
  await requireAdmin();
  const { items } = await listMedia();
  return (
    <>
      <UploadForm />
      {items.length === 0 ? (
        <p className="m-0 mt-10 text-base text-text-muted">
          Todavía no hay imágenes. Subí la primera con el formulario.
        </p>
      ) : (
        <>
          <p className="m-0 mt-10 text-base text-text-muted">
            {items.length === 1 ? "1 imagen" : `${items.length} imágenes`}
          </p>
          <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 p-0">
            {items.map((item) => {
              const { date, ...card } = toCardItem(item);
              return <MediaCard key={item.id} item={card} date={date} />;
            })}
          </ul>
        </>
      )}
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
