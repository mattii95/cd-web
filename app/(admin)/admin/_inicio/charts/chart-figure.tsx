import type { ReactNode } from "react";
import { CARD, CHART_BODY, SectionEmpty, accentStyle } from "../section-card";

export const SERIES = {
  blue: "var(--cms-series-1)",
  teal: "var(--cms-series-2)",
  amber: "var(--cms-series-3)",
  violet: "var(--cms-series-4)",
  rose: "var(--cms-series-5)",
  neutral: "var(--cms-series-neutral)",
} as const;
export const PALETTE = [SERIES.blue, SERIES.teal, SERIES.violet, SERIES.amber, SERIES.rose];

export const AXIS_TICK = { fill: "var(--color-cms-text)", fontSize: 13 };
export const TOOLTIP_STYLE = {
  border: "1px solid var(--color-cms-line)",
  borderRadius: 12,
  fontSize: 14,
  color: "var(--color-cms-ink)",
};

export type ChartTable = { columns: string[]; rows: (string | number)[][] };

// Marco de cada gráfico: <figure> con su título y alcance. El SVG se oculta a los lectores de
// pantalla y una tabla `sr-only` lleva los mismos datos. Sin datos, muestra `empty` y ninguna tabla.
export function ChartFigure({
  title,
  scope,
  accent,
  empty,
  emptyText,
  table,
  children,
}: {
  title: string;
  scope: string;
  accent: string;
  empty: boolean;
  emptyText: string;
  table: ChartTable;
  children: ReactNode;
}) {
  return (
    <figure style={accentStyle(accent)} className={`${CARD} m-0 flex flex-col gap-4 p-5 sm:p-6`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-display text-xl font-semibold text-cms-ink">{title}</span>
        <span className="text-sm text-cms-muted">{scope}</span>
      </figcaption>
      {empty ? (
        <SectionEmpty text={emptyText} className={CHART_BODY} />
      ) : (
        <>
          <div aria-hidden="true" className={`${CHART_BODY} w-full min-w-0`}>
            {children}
          </div>
          {/* sr-only va en el div: una <table> ignora el ancho de 1 px y desborda la página. */}
          <div className="sr-only">
            <table>
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={String(row[0])}>
                    {row.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </figure>
  );
}
