import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { countMedia, listMedia, type MediaQuery } from "@/db/media";
import { parseMediaParams, toUsage } from "@/lib/admin/media-params";
import { requireAdmin } from "@/lib/auth/dal";
import { toCardItem } from "./card-item";
import { MediaGrid } from "./media-grid";
import { MediaToolbar } from "./media-toolbar";
import { UploadButton } from "./upload-button";

export const metadata: Metadata = { title: "Medios" };

const SKELETONS = Array.from({ length: 12 }, (_, i) => i);

async function Library({ searchParams }: Pick<PageProps<"/admin/media">, "searchParams">) {
  await requireAdmin();
  const query = parseMediaParams(await searchParams);
  const filter: MediaQuery = { query: query.q ?? undefined, usage: toUsage(query.uso) ?? undefined };
  const [{ items, nextCursor }, total] = await Promise.all([listMedia(filter), countMedia(filter)]);
  const filtered = query.q !== null || query.uso !== null;
  // Una imagen nueva, o otra búsqueda o filtro, reinicia la grilla a la primera tanda.
  const key = `${query.q}|${query.uso}|${items.map((i) => i.id).join(",")}`;
  return (
    <>
      {(filtered || total > 0) && <MediaToolbar query={query} />}
      <MediaGrid
        key={key}
        initialItems={items.map(toCardItem)}
        initialCursor={nextCursor}
        initialTotal={total}
        query={query}
      />
    </>
  );
}

function Skeleton() {
  return (
    <ul
      role="status"
      aria-label="Cargando medios"
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 p-0"
    >
      {SKELETONS.map((i) => (
        <li
          key={i}
          aria-hidden="true"
          className="aspect-[4/5] animate-pulse rounded-xl bg-cms-head motion-reduce:animate-none"
        />
      ))}
    </ul>
  );
}

export default function MediosPage(props: PageProps<"/admin/media">) {
  return (
    <>
      <AdminPageHeader
        title="Medios"
        description="Subí y organizá las imágenes del blog."
        actions={<UploadButton />}
      />
      <Suspense fallback={<Skeleton />}>
        <Library searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
