"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartFigure, SERIES, TOOLTIP_STYLE } from "./chart-figure";

type Counts = { pendiente: number; aprobado: number; oculto: number };

const STATUSES = [
  { key: "pendiente", name: "Pendientes", color: SERIES.amber },
  { key: "aprobado", name: "Aprobados", color: SERIES.teal },
  { key: "oculto", name: "Ocultos", color: SERIES.neutral },
] as const;

export function CommentStatusChart({ data, scope }: { data: Counts; scope: string }) {
  const slices = STATUSES.map((s) => ({ name: s.name, value: data[s.key], fill: s.color }));
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return (
    <ChartFigure
      title="Comentarios por estado"
      scope={scope}
      accent={SERIES.teal}
      empty={total === 0}
      emptyText="No hubo comentarios en este período."
      table={{ columns: ["Estado", "Comentarios"], rows: slices.map((s) => [s.name, s.value]) }}
    >
      <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-36 w-full min-w-0 flex-1 sm:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="92%"
                stroke="var(--color-cms-panel)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </PieChart>
          </ResponsiveContainer>
          <p className="pointer-events-none absolute inset-0 m-0 flex flex-col items-center justify-center font-display text-3xl leading-none font-bold text-cms-ink">
            {total}
            <span className="mt-1 font-sans text-sm font-normal text-cms-muted">comentarios</span>
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-cms-text sm:w-44">
          {slices.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ background: s.fill }} />
              <span className="flex-1">{s.name}</span>
              <span className="font-semibold text-cms-ink">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFigure>
  );
}
