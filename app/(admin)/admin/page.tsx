import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  getActivitySeries,
  getCommentStatusBreakdown,
  getDashboardKpis,
  getPublishedByCategory,
  getRatingDistribution,
} from "@/db/admin-dashboard";
import { dashboardRange, parseDashboardParams } from "@/lib/admin/dashboard-params";
import { requireAdmin } from "@/lib/auth/dal";
import { ActivityChart } from "./_inicio/charts/activity-chart";
import { CategoryChart } from "./_inicio/charts/category-chart";
import { CommentStatusChart } from "./_inicio/charts/comment-status-chart";
import { RatingChart } from "./_inicio/charts/rating-chart";
import { KpiCards } from "./_inicio/kpi-cards";
import { PeriodTabs } from "./_inicio/period-tabs";
import { CHART_BODY, SectionCard, SectionEmpty, SectionError } from "./_inicio/section-card";
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

// Un fallo en la consulta de una sección no tumba la página: se registra y la sección muestra el error.
async function safe<T>(what: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`Inicio: no se pudo cargar ${what}`, error);
    return null;
  }
}

const periodScope = (periodo: number) => `Últimos ${periodo} días`;

function ChartError({ title, scope }: { title: string; scope: string }) {
  return (
    <SectionCard title={title} scope={scope}>
      <SectionError className={CHART_BODY} />
    </SectionCard>
  );
}

async function Kpis({ searchParams }: Search) {
  await requireAdmin();
  const { periodo } = parseDashboardParams(await searchParams);
  const kpis = await safe("los indicadores", () => getDashboardKpis(dashboardRange(periodo)));
  if (!kpis) {
    return (
      <SectionCard title="Indicadores">
        <SectionError className="h-24" />
      </SectionCard>
    );
  }
  return <KpiCards kpis={kpis} periodo={periodo} />;
}

async function Activity({ searchParams }: Search) {
  await requireAdmin();
  const { periodo } = parseDashboardParams(await searchParams);
  const range = dashboardRange(periodo);
  const data = await safe("la actividad", () => getActivitySeries(range));
  const scope = periodScope(periodo);
  if (!data) return <ChartError title="Actividad" scope={scope} />;
  return <ActivityChart data={data} bucket={range.bucket} scope={scope} />;
}

async function CommentStatus({ searchParams }: Search) {
  await requireAdmin();
  const { periodo } = parseDashboardParams(await searchParams);
  const data = await safe("los comentarios por estado", () =>
    getCommentStatusBreakdown(dashboardRange(periodo)),
  );
  const scope = periodScope(periodo);
  if (!data) return <ChartError title="Comentarios por estado" scope={scope} />;
  return <CommentStatusChart data={data} scope={scope} />;
}

async function Ratings({ searchParams }: Search) {
  await requireAdmin();
  const { periodo } = parseDashboardParams(await searchParams);
  const data = await safe("las estrellas", () => getRatingDistribution(dashboardRange(periodo)));
  const scope = periodScope(periodo);
  if (!data) return <ChartError title="Distribución de estrellas" scope={scope} />;
  return <RatingChart data={data} scope={scope} />;
}

async function Categories() {
  await requireAdmin();
  const data = await safe("los artículos por categoría", getPublishedByCategory);
  if (!data) return <ChartError title="Artículos por categoría" scope="En total" />;
  return <CategoryChart data={data} scope="En total" />;
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
    <SectionCard title={title} scope={scope === "period" ? periodScope(periodo) : scope}>
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
        <Activity searchParams={searchParams} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton title="Comentarios por estado" />}>
          <CommentStatus searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton title="Distribución de estrellas" />}>
          <Ratings searchParams={searchParams} />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton title="Artículos por categoría" />}>
          <Categories />
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
