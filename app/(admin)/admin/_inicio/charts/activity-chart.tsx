"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bucketLabel } from "@/lib/admin/dashboard-params";
import { AXIS_TICK, ChartFigure, SERIES, TOOLTIP_STYLE } from "./chart-figure";

// Misma forma que `ActivityPoint` de db/admin-dashboard (no se importa: ese módulo es solo de servidor).
type Point = { key: string; users: number; comments: number; ratings: number };

const SERIES_DEF = [
  { key: "users", name: "Altas de usuarios", color: SERIES.blue },
  { key: "comments", name: "Comentarios", color: SERIES.teal },
  { key: "ratings", name: "Valoraciones", color: SERIES.amber },
] as const;

export function ActivityChart({
  data,
  bucket,
  scope,
}: {
  data: Point[];
  bucket: "day" | "week";
  scope: string;
}) {
  const points = data.map((p) => ({ ...p, label: bucketLabel(p.key, bucket) }));
  return (
    <ChartFigure
      title="Actividad"
      scope={scope}
      empty={data.every((p) => p.users + p.comments + p.ratings === 0)}
      emptyText="No hubo actividad en este período."
      table={{
        columns: [bucket === "week" ? "Semana" : "Día", ...SERIES_DEF.map((s) => s.name)],
        rows: points.map((p) => [p.label, p.users, p.comments, p.ratings]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--color-cms-line-soft)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 14 }} />
          {SERIES_DEF.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
