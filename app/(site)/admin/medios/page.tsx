import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { listMedia, type MediaItem } from "@/db/media";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format-date";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "Medios",
  robots: { index: false, follow: false },
};

function MediaCard({ item }: { item: MediaItem }) {
  const titles = [...new Set(item.usage.map((u) => u.title))];
  return (
    <li className="flex flex-col overflow-hidden rounded-[18px] border border-border-muted bg-surface-2">
      <Image
        src={item.src}
        width={item.width}
        height={item.height}
        alt={item.alt}
        sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
        className="aspect-video w-full bg-surface-3 object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="m-0 text-[15px] leading-snug font-semibold text-text-strong [overflow-wrap:anywhere]">
          {item.alt}
        </p>
        <p className="m-0 text-[13px] text-text-subtle">
          {item.width} × {item.height} px, {Math.max(1, Math.round(item.bytes / 1024))} KB
          <br />
          {formatDate(item.createdAt)}
        </p>
        <p
          className={`m-0 mt-auto pt-1 text-[13px] ${titles.length ? "text-accent-soft" : "text-text-subtle"}`}
        >
          {titles.length ? `En uso en: ${titles.join(", ")}` : "Sin usar"}
        </p>
      </div>
    </li>
  );
}

async function Library() {
  await requireAdmin();
  const items = await listMedia();
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
            {items.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
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
