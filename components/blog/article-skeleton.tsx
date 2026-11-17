// Misma silueta que el artículo: cabecera oscura con título y portada, índice y texto.
export function ArticleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando artículo" role="status">
      <section className="bg-background text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-6 pt-[132px] motion-safe:animate-pulse">
          <div className="h-4 w-40 rounded-md bg-white/10" />
          <div className="h-12 w-full max-w-[760px] rounded-md bg-white/10" />
          <div className="h-12 w-2/3 max-w-[520px] rounded-md bg-white/10" />
          <div className="h-5 w-full max-w-[620px] rounded-md bg-white/10" />
          <div className="mt-6 h-[clamp(220px,32vw,420px)] rounded-t-3xl border border-b-0 border-white/12 bg-white/5" />
        </div>
      </section>
      <section className="bg-paper px-6 pt-16 pb-24">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-14 motion-safe:animate-pulse">
          <div className="h-[220px] max-w-[300px] flex-[1_1_240px] rounded-[18px] border border-paper-border bg-white" />
          <div className="flex max-w-[760px] min-w-0 flex-[999_1_560px] flex-col gap-4">
            {[100, 92, 97, 60, 100, 88, 94, 45].map((w, i) => (
              <div
                key={i}
                style={{ width: `${w}%` }}
                className="h-4 rounded-md bg-paper-border"
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
