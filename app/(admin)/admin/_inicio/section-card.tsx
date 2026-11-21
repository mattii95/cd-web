import type { CSSProperties, ReactNode } from "react";

// Marco común de cada sección del Inicio: título, alcance ("En total", "Últimos 30 días") y contenido.
// Mismo borde y sombra que las tablas del panel, con una franja de color arriba: cada sección
// toma su color de `--accent` (ver `accentStyle`); sin él, la franja queda en el color del borde.
export const CARD =
  "rounded-2xl border border-t-4 border-cms-line border-t-(--accent,var(--color-cms-line)) bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]";
export const accentStyle = (color?: string) =>
  color ? ({ "--accent": color } as CSSProperties) : undefined;
// Color de cada sección por su título: así lo toman también sus esqueletos, listas y errores.
const TITLE_ACCENT: Record<string, string> = {
  Actividad: "var(--cms-series-1)",
  "Comentarios por estado": "var(--cms-series-2)",
  "Distribución de estrellas": "var(--cms-series-3)",
  "Artículos por categoría": "var(--cms-series-4)",
  "Top artículos": "var(--cms-series-5)",
  "Pendientes más viejos": "var(--cms-series-3)",
  "Últimos registrados": "var(--cms-series-1)",
};
// Alto fijo del cuerpo de un gráfico: el esqueleto y el gráfico final miden lo mismo.
export const CHART_BODY = "h-60 md:h-70";

export function SectionCard({
  title,
  scope,
  accent,
  className = "",
  children,
}: {
  title: string;
  scope?: string;
  accent?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      style={accentStyle(accent ?? TITLE_ACCENT[title])}
      className={`${CARD} flex flex-col gap-4 p-5 sm:p-6 ${className}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 font-display text-xl font-semibold text-cms-ink">{title}</h2>
        {scope && <p className="m-0 text-sm text-cms-muted">{scope}</p>}
      </header>
      {children}
    </section>
  );
}

// `className` fija el alto cuando la sección tiene uno (por ejemplo CHART_BODY).
export function SectionEmpty({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`m-0 flex items-center justify-center text-center text-base text-cms-text ${className}`}>
      {text}
    </p>
  );
}

export function SectionError({ className = "" }: { className?: string }) {
  return (
    <p
      role="alert"
      className={`m-0 flex items-center justify-center text-center text-base text-cms-text ${className}`}
    >
      No pudimos cargar estos datos.
    </p>
  );
}
