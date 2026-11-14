import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Página no encontrada" };

// Vive fuera de (site): el 404 global no pasa por ese layout, así que trae su header y footer.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 items-center overflow-hidden bg-background text-white">
        <div
          aria-hidden="true"
          className="fx-grid absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]"
        />
        <div
          aria-hidden="true"
          className="fx-orb fx-orb1 top-10 -right-25 size-[480px] bg-accent/40"
        />
        {/* pt: 92px de header (absoluto) + aire */}
        <div className="relative mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 pt-[148px] pb-24">
          <p className="fx-rise d1 m-0 font-mono text-sm text-accent-soft">
            $ abrir /esa-pagina
            <span className="fx-caret ml-1 inline-block h-[1em] w-2 translate-y-[3px] bg-accent-soft" />
          </p>
          <h1 className="fx-rise d2 m-0 max-w-[760px] font-display text-[clamp(40px,5.6vw,72px)] leading-[1.02] font-bold tracking-[-0.03em]">
            Esta página no existe
          </h1>
          <p className="fx-rise d3 m-0 max-w-[560px] text-lg leading-[1.6] text-text-muted">
            El link puede tener un error o la página cambió de lugar. Volvé al inicio o
            buscá lo que necesitás en el blog.
          </p>
          <div className="fx-rise d4 flex flex-wrap gap-2.5">
            <Link
              href="/"
              className="fx-btn inline-flex min-h-12 items-center rounded-full bg-accent px-[22px] py-[13px] text-[15px] font-semibold text-white no-underline"
            >
              Volver al inicio
            </Link>
            <Link
              href="/blog"
              className="fx-ghost inline-flex min-h-12 items-center rounded-full border border-white/25 px-[22px] py-[13px] text-[15px] font-semibold text-white no-underline"
            >
              Ir al blog
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
