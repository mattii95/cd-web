"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartFigure, SERIES, TOOLTIP_STYLE } from "./chart-figure";

type Row = { stars: 1 | 2 | 3 | 4 | 5; count: number };

export function RatingChart({ data, scope }: { data: Row[]; scope: string }) {
  const rows = data.map((r) => ({ label: `${r.stars} ★`, count: r.count }));
  return (
    <ChartFigure
      title="Distribución de estrellas"
      scope={scope}
      accent={SERIES.amber}
      empty={data.every((r) => r.count === 0)}
      emptyText="No hubo valoraciones en este período."
      table={{ columns: ["Estrellas", "Valoraciones"], rows: rows.map((r) => [r.label, r.count]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-cms-head)" }} formatter={(v) => [v, "Valoraciones"]} />
          <Bar dataKey="count" fill={SERIES.amber} radius={[0, 6, 6, 0]} barSize={24} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" style={{ fill: "var(--color-cms-ink)", fontSize: 13, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
