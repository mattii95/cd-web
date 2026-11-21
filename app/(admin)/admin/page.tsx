import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getDashboardKpis } from "@/db/admin-dashboard";
import { dashboardRange, parseDashboardParams } from "@/lib/admin/dashboard-params";
import { requireAdmin } from "@/lib/auth/dal";
import { KpiCards } from "./_inicio/kpi-cards";
import { PeriodTabs } from "./_inicio/period-tabs";
import { SectionCard, SectionEmpty, SectionError } from "./_inicio/section-card";
import { ChartSkeleton, KpiCardsSkeleton, ListSkeleton } from "./_inicio/skeletons";

export const metadata: Metadata = { title: "Inicio" };

type Search = Pick<PageProps<"/admin">, "searchParams">;

async function Greeting() {
  const { name } = await requireAdmin();
  return (
    <p className="m-0 font-display text-2xl font-semibold text-cms-ink">
      Hola, {name.split(" ")[0]}
    </p>
  );
}

async function Period({ searchParams }: Search) {
  await requireAdmin();
  return <PeriodTabs query={parseDashboardParams(await searchParams)} />;
}

async function Kpis({ searchParams }: Search) {
  await requireAdmin();
  const { periodo } = parseDashboardParams(await searchParams);
  let kpis;
  try {
    kpis = await getDashboardKpis(dashboardRange(periodo));
  } catch (error) {
    console.error("Inicio: no se pudieron cargar los indicadores", error);
    return (
      <SectionCard title="Indicadores">
        <SectionError className="h-24" />
      </SectionCard>
    );
  }
  return <KpiCards kpis={kpis} periodo={periodo} />;
}

// Provisoria: cada sección real (KPIs, gráficos, listas) reemplaza a esta en los pasos 4 a 6.
async function Pending({
  title,
  scope,
  searchParams,
}: Search & { title: string; scope: "period" | string; className?: string }) {
  await requireAdmin();
  const { periodo } = parseDashboardParams(await searchParams);
  return (
    <SectionCard title={title} scope={scope === "period" ? `Últimos ${periodo} días` : scope}>
      <SectionEmpty text="Próximamente." className="h-40" />
    </SectionCard>
  );
}

export default function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <AdminPageHeader title="Inicio" description="Cómo vienen el blog y la comunidad." />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Suspense fallback={<div className="h-8" />}>
          <Greeting />
        </Suspense>
        <Suspense fallback={<div className="h-13" />}>
          <Period searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<KpiCardsSkeleton />}>
        <Kpis searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ChartSkeleton title="Actividad" />}>
        <Pending title="Actividad" scope="period" searchParams={searchParams} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton title="Comentarios por estado" />}>
          <Pending title="Comentarios por estado" scope="period" searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton title="Distribución de estrellas" />}>
          <Pending title="Distribución de estrellas" scope="period" searchParams={searchParams} />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton title="Artículos por categoría" />}>
          <Pending title="Artículos por categoría" scope="En total" searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Top artículos" />}>
          <Pending title="Top artículos" scope="period" searchParams={searchParams} />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ListSkeleton title="Pendientes más viejos" />}>
          <Pending title="Pendientes más viejos" scope="Ahora" searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Últimos registrados" />}>
          <Pending title="Últimos registrados" scope="Ahora" searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
