import Link from "next/link";
import { DASHBOARD_PERIODS, type DashboardQuery, dashboardHref } from "@/lib/admin/dashboard-params";

export function PeriodTabs({ query }: { query: DashboardQuery }) {
  return (
    <nav
      aria-label="Período"
      className="inline-flex gap-1 rounded-xl border border-cms-line bg-cms-panel p-1"
    >
      {DASHBOARD_PERIODS.map((periodo) => {
        const active = query.periodo === periodo;
        return (
          <Link
            key={periodo}
            href={dashboardHref({ periodo })}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
              active ? "bg-cms-link text-white" : "text-cms-text hover:bg-cms-chip hover:text-cms-ink"
            }`}
          >
            {periodo} días
          </Link>
        );
      })}
    </nav>
  );
}
