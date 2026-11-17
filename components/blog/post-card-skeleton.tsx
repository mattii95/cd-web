// Misma silueta que PostCard: miniatura 16:9, píldora, título de dos líneas y extracto.
export function PostCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-1 flex-col overflow-hidden rounded-[20px] border border-paper-border bg-white motion-safe:animate-pulse"
    >
      <div className="aspect-video bg-paper-border/70" />
      <div className="flex flex-1 flex-col gap-2.5 px-6 pt-[22px] pb-[26px]">
        <div className="h-6 w-40 rounded-full bg-paper-border" />
        <div className="h-5 w-11/12 rounded-md bg-paper-border" />
        <div className="h-5 w-2/3 rounded-md bg-paper-border" />
        <div className="mt-1 h-4 w-full rounded-md bg-paper-border/70" />
        <div className="h-4 w-4/5 rounded-md bg-paper-border/70" />
      </div>
    </div>
  );
}
