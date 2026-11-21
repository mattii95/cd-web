import { CARD, CHART_BODY, SectionCard } from "./section-card";

const BAR = "animate-pulse rounded bg-cms-head motion-reduce:animate-none";

export function KpiCardsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando indicadores"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${CARD} flex min-h-40 flex-col gap-3 p-5 sm:p-6`}>
          <div className={`${BAR} h-4 w-24`} />
          <div className={`${BAR} h-10 w-32`} />
          <div className={`${BAR} h-4 w-40`} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <SectionCard title={title} className={className}>
      <div
        role="status"
        aria-label={`Cargando ${title}`}
        className={`${BAR} ${CHART_BODY} rounded-xl`}
      />
    </SectionCard>
  );
}

export function ListSkeleton({ title }: { title: string }) {
  return (
    <SectionCard title={title}>
      <div role="status" aria-label={`Cargando ${title}`} className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${BAR} h-14 rounded-xl`} />
        ))}
      </div>
    </SectionCard>
  );
}
