import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardKpis } from "@/db/admin-dashboard";
import { type Change, type DashboardPeriod, percentChange } from "@/lib/admin/dashboard-params";
import { CARD } from "./section-card";

const nf = new Intl.NumberFormat("es-AR");
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`;

// Sube = verde y baja = gris neutro (menos comentarios no es un error).
function ChangeBadge({ change, periodo }: { change: Change; periodo: DashboardPeriod }) {
  const prev = `los ${periodo} días anteriores`;
  const green = "text-green-700";
  const grey = "text-cms-muted";
  let text: string, name: string, tone: string;
  switch (change.kind) {
    case "up":
      [text, name, tone] = [`↑ ${change.pct} %`, `${change.pct} % más que ${prev}`, green];
      break;
    case "down":
      [text, name, tone] = [`↓ ${change.pct} %`, `${change.pct} % menos que ${prev}`, grey];
      break;
    case "same":
      [text, name, tone] = ["Sin cambios", `Sin cambios respecto de ${prev}`, grey];
      break;
    case "new":
      [text, name, tone] = ["Nuevo", `Sin datos en ${prev}`, green];
      break;
  }
  return (
    <span role="img" aria-label={name} className={`text-sm font-semibold ${tone}`}>
      {text}
    </span>
  );
}

function Card({
  title,
  scope,
  href,
  value,
  children,
}: {
  title: string;
  scope: string;
  href?: string;
  value: string;
  children: ReactNode;
}) {
  const heading = <h3 className="m-0 font-display text-base font-semibold text-cms-ink">{title}</h3>;
  return (
    <article className={`${CARD} relative flex min-h-40 flex-col gap-2 p-5 sm:p-6`}>
      <header className="flex items-baseline justify-between gap-3">
        {href ? (
          // Enlace extendido: toda la tarjeta navega; los enlaces internos van por encima (z-10).
          <Link href={href} className="no-underline after:absolute after:inset-0 after:rounded-2xl hover:underline">
            {heading}
          </Link>
        ) : (
          heading
        )}
        <p className="m-0 text-sm text-cms-muted">{scope}</p>
      </header>
      <p className="m-0 font-display text-4xl leading-none font-bold tracking-[-0.02em] text-cms-ink">{value}</p>
      <div className="mt-auto flex flex-col gap-1 text-sm text-cms-text">{children}</div>
    </article>
  );
}

const Line = ({ children }: { children: ReactNode }) => (
  <p className="m-0 flex flex-wrap items-center gap-x-2">{children}</p>
);

export function KpiCards({ kpis, periodo }: { kpis: DashboardKpis; periodo: DashboardPeriod }) {
  const { users, comments, posts, ratings } = kpis;
  const scope = `Últimos ${periodo} días`;
  const average = ratings.average === null ? null : ratings.average.toFixed(1).replace(".", ",");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="Usuarios" scope="En total" href="/admin/users" value={nf.format(users.total)}>
        <Line>
          +{nf.format(users.signups.current)} en el período
          <ChangeBadge change={percentChange(users.signups.current, users.signups.previous)} periodo={periodo} />
        </Line>
      </Card>

      <Card title="Comentarios" scope={scope} href="/admin/comments" value={nf.format(comments.created.current)}>
        <Line>
          <ChangeBadge change={percentChange(comments.created.current, comments.created.previous)} periodo={periodo} />
        </Line>
        <Link
          href="/admin/comments"
          className="relative z-10 inline-flex min-h-11 items-center self-start font-semibold text-cms-link underline-offset-2 hover:underline"
        >
          {plural(comments.pending, "pendiente", "pendientes")}
        </Link>
      </Card>

      <Card title="Artículos" scope="En total" href="/admin/articles" value={nf.format(posts.published)}>
        <Line>
          +{nf.format(posts.publishedInPeriod.current)} {posts.publishedInPeriod.current === 1 ? "publicado" : "publicados"} en el período
          <ChangeBadge
            change={percentChange(posts.publishedInPeriod.current, posts.publishedInPeriod.previous)}
            periodo={periodo}
          />
        </Line>
        <Line>{plural(posts.drafts, "borrador", "borradores")}</Line>
      </Card>

      <Card title="Valoraciones" scope={scope} value={average === null ? "—" : `${average} ★`}>
        {average === null ? (
          <Line>Sin valoraciones en el período</Line>
        ) : (
          <Line>
            {plural(ratings.count.current, "valoración", "valoraciones")}
            <ChangeBadge change={percentChange(ratings.count.current, ratings.count.previous)} periodo={periodo} />
          </Line>
        )}
      </Card>
    </div>
  );
}
