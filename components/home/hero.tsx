import Link from "next/link";
import { ArrowRight, Check } from "@/components/icons";
import { TypedText } from "@/components/home/typed-text";

const gridBg =
  "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]";

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-background text-white"
    >
      {/* Fondo decorativo */}
      <div aria-hidden="true" className={`fx-grid absolute inset-0 ${gridBg}`} />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 top-10 -right-30 size-[520px] bg-accent/45"
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb2 top-[360px] -left-40 size-[420px] bg-accent-light/[0.22]"
      />
      <div
        aria-hidden="true"
        className="fx-ring absolute top-[120px] -right-40 size-[560px] rounded-full border border-dashed border-accent-light/35"
      >
        <span className="absolute -top-[5px] left-1/2 size-2.5 rounded-full bg-accent-light shadow-[0_0_16px_4px_rgba(77,139,255,0.8)]" />
      </div>
      <div
        aria-hidden="true"
        className="fx-ringr absolute top-[220px] -right-15 size-[360px] rounded-full border border-accent/30"
      >
        <span className="absolute top-1/2 -left-1 size-2 rounded-full bg-accent-pale shadow-[0_0_12px_3px_rgba(157,187,255,0.8)]" />
      </div>

      {/* pt: 92px de header (absoluto) + 72px de aire */}
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] items-center gap-14 px-6 pt-[164px] pb-28">
        <div className="flex flex-col gap-7">
          <span className="fx-rise d1 inline-flex items-center gap-2.5 self-start rounded-full border border-accent/40 bg-accent/[0.14] px-3.5 py-2 text-[13px] font-semibold text-accent-softer">
            <span className="fx-dot size-2 rounded-full bg-accent-light" />
            Desarrollo web · Software · IA
          </span>

          <h1
            aria-label="Hacemos crecer tu negocio con desarrollo web, sistemas a medida, productos SaaS e inteligencia artificial"
            className="fx-rise d2 m-0 flex flex-col gap-3.5"
          >
            <span className="font-display text-[clamp(40px,5.2vw,66px)] leading-[1.02] font-bold tracking-[-0.03em]">
              Hacemos crecer tu negocio con
            </span>
            <span
              aria-hidden="true"
              className="flex min-h-[1.3em] items-center font-mono text-[clamp(26px,3.2vw,44px)] leading-[1.3] font-bold tracking-[-0.02em] whitespace-nowrap text-accent-light [text-shadow:0_0_24px_rgba(77,139,255,0.55)]"
            >
              <span className="mr-[0.6em] text-text-subtle">&gt;</span>
              <TypedText />
            </span>
          </h1>

          <p className="fx-rise d3 m-0 max-w-[520px] text-lg leading-[1.6] text-text-muted">
            Diseñamos y desarrollamos sitios web, sistemas a medida, productos
            SaaS y soluciones con inteligencia artificial. Todo en un mismo
            equipo.
          </p>

          <div className="fx-rise d4 flex flex-wrap gap-3">
            <Link
              href="#servicios"
              className="fx-btn inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-accent px-[26px] py-4 text-base font-semibold text-white no-underline"
            >
              Ver servicios
              <ArrowRight />
            </Link>
            <Link
              href="#blog"
              className="fx-ghost inline-flex min-h-[52px] items-center rounded-full border border-white/[0.22] px-[26px] py-4 text-base font-semibold text-white no-underline"
            >
              Leer el blog
            </Link>
          </div>
        </div>

        {/* Mockup del navegador */}
        <div aria-hidden="true" className="fx-rise d3 relative pt-6 pb-10">
          <div className="fx-float fx-beam relative overflow-hidden rounded-[18px] border border-white/10 bg-surface-2 shadow-[0_40px_80px_rgba(0,0,0,0.45),0_0_80px_rgba(26,102,245,0.25)]">
            <span className="fx-scan" />
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3.5">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="ml-3 flex h-6 flex-1 items-center rounded-md bg-white/[0.06] px-2.5 text-[11px] text-text-subtle">
                tumarca.com
              </span>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <span className="h-2.5 w-[70px] rounded bg-border-strong" />
                <span className="flex gap-2">
                  <span className="h-2 w-9 rounded bg-border-muted" />
                  <span className="h-2 w-9 rounded bg-border-muted" />
                  <span className="h-2 w-9 rounded bg-border-muted" />
                </span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4 py-3">
                <div className="flex flex-col gap-2.5">
                  <span className="h-4 w-[90%] rounded bg-[#e8eefc]" />
                  <span className="h-4 w-[70%] rounded bg-[#e8eefc]" />
                  <span className="mt-1.5 h-2 w-[85%] rounded bg-border-strong" />
                  <span className="h-2 w-[60%] rounded bg-border-strong" />
                  <span className="mt-2 h-7 w-24 rounded-full bg-accent" />
                </div>
                <div className="h-[150px] rounded-xl bg-[linear-gradient(135deg,#1a66f5,#0b2e7a)]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <span className="h-16 rounded-[10px] bg-surface-4" />
                <span className="h-16 rounded-[10px] bg-surface-4" />
                <span className="h-16 rounded-[10px] bg-surface-4" />
              </div>
            </div>
          </div>

          {/* Tarjeta flotante: tráfico */}
          <div className="fx-float2 absolute bottom-0 left-0 flex w-60 flex-col gap-2.5 rounded-2xl bg-white px-[18px] py-4 text-surface shadow-[0_24px_48px_rgba(0,0,0,0.35)] sm:-left-7">
            <span className="text-xs font-semibold text-text-faint">
              Tráfico del sitio
            </span>
            <svg width="204" height="56" viewBox="0 0 204 56" fill="none">
              <path
                d="M2 50 L30 44 L58 46 L86 34 L114 36 L142 22 L170 18 L202 6"
                stroke="#1A66F5"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 50 L30 44 L58 46 L86 34 L114 36 L142 22 L170 18 L202 6 L202 56 L2 56 Z"
                fill="rgba(26,102,245,0.12)"
              />
            </svg>
            <span className="text-xs text-text-faint">
              SEO + campañas activas
            </span>
          </div>

          {/* Badge mobile */}
          <div className="fx-float2 absolute top-0 -right-2 flex items-center gap-2 rounded-[14px] bg-accent px-4 py-3 text-[13px] font-semibold text-white shadow-[0_16px_32px_rgba(26,102,245,0.4)]">
            <Check />
            Optimizada para celular
          </div>
        </div>
      </div>
    </section>
  );
}
