"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, ChartFigure, SERIES, TOOLTIP_STYLE } from "./chart-figure";

type Row = { id: string; label: string; count: number };

export function CategoryChart({ data, scope }: { data: Row[]; scope: string }) {
  return (
    <ChartFigure
      title="Artículos por categoría"
      scope={scope}
      empty={data.every((r) => r.count === 0)}
      emptyText="Todavía no hay artículos publicados."
      table={{ columns: ["Categoría", "Artículos publicados"], rows: data.map((r) => [r.label, r.count]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} width={120} interval={0} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-cms-head)" }} formatter={(v) => [v, "Publicados"]} />
          <Bar dataKey="count" fill={SERIES.blue} radius={[0, 6, 6, 0]} barSize={24} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" style={{ fill: "var(--color-cms-ink)", fontSize: 13, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
