import type { ReactNode } from "react";

// Marco común de cada sección del Inicio: título, alcance ("En total", "Últimos 30 días") y contenido.
// Mismo borde y sombra que las tablas del panel.
export const CARD =
  "rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]";
// Alto fijo del cuerpo de un gráfico: el esqueleto y el gráfico final miden lo mismo.
export const CHART_BODY = "h-60 md:h-70";

export function SectionCard({
  title,
  scope,
  className = "",
  children,
}: {
  title: string;
  scope?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={`${CARD} flex flex-col gap-4 p-5 sm:p-6 ${className}`}>
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
