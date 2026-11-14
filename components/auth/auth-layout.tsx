import type { ReactNode } from "react";

// Pantalla completa dividida: panel oscuro + formulario sobre fondo claro.
// Debajo de 960px (dos columnas de 480px) el panel queda arriba.
export function AuthLayout({
  panel,
  children,
}: {
  panel: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] bg-paper text-ink [color-scheme:light]">
      {panel}
      <main className="relative flex items-center justify-center overflow-hidden px-6 py-[clamp(32px,5vw,72px)]">
        <div
          className="fx-orb fx-orb2 -right-[60px] -bottom-20 size-[360px] bg-accent/12"
          aria-hidden="true"
        />
        {children}
      </main>
    </div>
  );
}
