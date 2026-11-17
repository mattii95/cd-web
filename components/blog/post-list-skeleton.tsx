import { PostCardSkeleton } from "./post-card-skeleton";

// Misma silueta que PostList: filtros, destacado y tres tarjetas.
export function PostListSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando artículos"
      className="bg-paper px-6 pt-[72px] pb-24"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 motion-safe:animate-pulse">
        <div className="flex flex-col gap-3">
          <div className="h-[58px] w-full max-w-[460px] rounded-full border border-paper-border bg-white" />
          <div className="h-11 w-full max-w-[640px] rounded-lg bg-paper-border/70" />
        </div>
        <div className="grid min-h-[340px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] overflow-hidden rounded-3xl border border-paper-border bg-white">
          <div className="min-h-[220px] bg-paper-border/70" />
          <div className="flex flex-col justify-center gap-4 p-[clamp(28px,4vw,48px)]">
            <div className="h-6 w-48 rounded-full bg-paper-border" />
            <div className="h-8 w-11/12 rounded-md bg-paper-border" />
            <div className="h-8 w-2/3 rounded-md bg-paper-border" />
            <div className="h-4 w-full rounded-md bg-paper-border/70" />
          </div>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-6 p-0">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex">
              <PostCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
