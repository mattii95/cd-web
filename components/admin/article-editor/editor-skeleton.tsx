export function EditorSkeleton() {
  return (
    <div role="status" aria-label="Cargando el editor" className="flex flex-col gap-6">
      <div className="h-24 animate-pulse rounded-2xl bg-cms-head motion-reduce:animate-none" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[32rem] animate-pulse rounded-2xl border border-cms-line bg-cms-panel motion-reduce:animate-none" />
        <div className="h-80 animate-pulse rounded-2xl border border-cms-line bg-cms-panel motion-reduce:animate-none" />
      </div>
    </div>
  );
}
