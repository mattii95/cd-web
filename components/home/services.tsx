import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { services, type Service } from "@/lib/services";

/* -------------------------------------------------------------------------
   Mini-mockups (decorativos). Cada uno ocupa el área de 300px de alto de la
   card. Las animaciones están definidas en globals.css (sv-*, ia-*).
   ------------------------------------------------------------------------- */

const stage =
  "relative flex h-[300px] items-center justify-center overflow-hidden border-b border-white/[0.08]";

const trafficDots = (
  <>
    <span className="size-1.5 rounded-full bg-border-strong" />
    <span className="size-1.5 rounded-full bg-border-strong" />
    <span className="size-1.5 rounded-full bg-border-strong" />
  </>
);

// 01 · Desarrollo web: marco que cambia de 1440 a 768 a 375px
function WebMockup() {
  return (
    <div
      aria-hidden="true"
      className={`${stage} bg-background bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]`}
    >
      <div className="sv-resp relative h-[220px] w-[360px] max-w-[86%] overflow-hidden rounded-xl border border-white/[0.16] bg-[#081126] shadow-[0_0_50px_rgba(26,102,245,0.18)]">
        <div className="flex items-center gap-[5px] border-b border-white/[0.08] px-3 py-[9px]">
          {trafficDots}
          <span className="relative ml-auto h-3 w-11 font-mono text-[10px] leading-3 text-accent-light">
            <span className="sv-l1 absolute top-0 right-0">1440PX</span>
            <span className="sv-l2 absolute top-0 right-0">768PX</span>
            <span className="sv-l3 absolute top-0 right-0">375PX</span>
          </span>
        </div>
        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="h-2 w-[34px] rounded bg-[#e8eefc]" />
            <span className="ml-auto h-1.5 w-[22px] rounded-[3px] bg-border-strong" />
            <span className="h-1.5 w-[22px] rounded-[3px] bg-border-strong" />
            <span className="h-1.5 w-[22px] rounded-[3px] bg-border-strong" />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div className="flex flex-[1_1_110px] flex-col gap-1.5">
              <span className="h-[9px] w-[90%] rounded-[3px] bg-[#e8eefc]" />
              <span className="h-[9px] w-[65%] rounded-[3px] bg-[#e8eefc]" />
              <span className="mt-[3px] h-[5px] w-[80%] rounded-[3px] bg-border-strong" />
              <span className="fx-dot mt-1 h-4 w-[52px] rounded-full bg-accent" />
            </div>
            <div className="h-16 flex-[1_1_100px] rounded-lg bg-[linear-gradient(135deg,#1a66f5,#0b2e7a)]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 0.2, 0.4, 0.6].map((delay) => (
              <span
                key={delay}
                className="sv-tile h-[34px] flex-[1_1_60px] rounded-md"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 02 · Sistemas a medida: panel de gestión
const barHeights = [55, 80, 65, 95, 70, 100, 60, 85];

function SystemsMockup() {
  return (
    <div
      aria-hidden="true"
      className={`${stage} bg-background bg-[radial-gradient(circle_at_50%_120%,rgba(26,102,245,0.25),transparent_60%)]`}
    >
      <div className="grid h-[220px] w-[380px] max-w-[88%] grid-cols-[64px_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/[0.16] bg-[#081126]">
        <div className="relative flex flex-col gap-2 border-r border-white/[0.08] px-2 py-3">
          <span className="sv-nav absolute inset-x-1.5 top-2.5 h-7 rounded-md border border-accent-light/55 bg-accent/25" />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="relative flex h-6 items-center gap-[5px] px-1.5">
              <span className="size-2 rounded-sm bg-accent-light" />
              <span className="h-1 flex-1 rounded-sm bg-border-strong" />
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="h-2 w-[70px] rounded bg-[#e8eefc]" />
            <span className="inline-flex items-center gap-[5px] rounded-full border border-accent-light/40 px-2 py-[3px] text-[10px] text-accent-softer">
              <svg
                className="sv-spin"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 11-6.2-8.6" />
              </svg>
              Sincronizando
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="h-[30px] rounded-md border-t-2 border-accent bg-surface-4" />
            <span className="h-[30px] rounded-md bg-surface-4" />
            <span className="h-[30px] rounded-md bg-surface-4" />
          </div>
          <div className="flex flex-1 items-end gap-1.5 border-b border-white/10 pt-1">
            {barHeights.map((h, i) => (
              <span
                key={i}
                className={`sv-bar flex-1 rounded-t-[3px] ${
                  h === 100
                    ? "bg-[linear-gradient(180deg,#bfd3ff,#1a66f5)]"
                    : "bg-[linear-gradient(180deg,#4d8bff,#1a66f5)]"
                }`}
                style={{
                  height: `${h}%`,
                  animationDelay: i === 0 ? undefined : `${-0.3 * i}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 03 · SaaS: plataforma conectada a clientes
const userIcon = (x: number) => (
  <g
    transform={`translate(${x} 188)`}
    stroke="#D5DCEB"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="12" cy="9" r="3.5" />
    <path d="M5.5 19a6.5 6.5 0 0113 0" />
  </g>
);

const plans = [
  { x: 90, label: "Básico" },
  { x: 210, label: "Pro" },
  { x: 330, label: "Empresa" },
];

function SaasMockup() {
  return (
    <div
      aria-hidden="true"
      className={`${stage} bg-background bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]`}
    >
      <div className="relative h-[280px] w-[420px] flex-none max-sm:scale-[0.72]">
        <svg
          width="420"
          height="280"
          viewBox="0 0 420 280"
          fill="none"
          className="absolute top-0 left-0"
        >
          {["M210 102 L90 174", "M210 102 L210 174", "M210 102 L330 174"].map((d) => (
            <path
              key={d}
              className="sv-flow"
              d={d}
              stroke="#4D8BFF"
              strokeOpacity="0.6"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
          ))}
          <circle
            className="sv-ring"
            cx="210"
            cy="70"
            r="44"
            stroke="#4D8BFF"
            strokeOpacity="0.55"
            strokeDasharray="3 8"
          />
          <circle cx="210" cy="70" r="32" fill="#0D1730" stroke="#4D8BFF" strokeWidth="1.5" />
          <g
            transform="translate(198 58)"
            stroke="#BFD3FF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4 4 0 01-.5 9.5H7z" />
          </g>
          <text x="262" y="74" fill="#A8B3C9" fontSize="11" fontFamily="Inter, sans-serif">
            Tu plataforma
          </text>
          {plans.map(({ x }, i) => (
            <circle
              key={x}
              className="sv-node"
              cx={x}
              cy="200"
              r="26"
              fill="#0D1730"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
              style={{ animationDelay: `${-1.5 + i}s` }}
            />
          ))}
          {plans.map(({ x }) => (
            <g key={x}>{userIcon(x - 12)}</g>
          ))}
          {plans.map(({ x, label }) => (
            <g key={label}>
              <rect
                x={x - 34}
                y="238"
                width="68"
                height="20"
                rx="10"
                fill="rgba(26,102,245,0.15)"
                stroke="rgba(77,139,255,0.45)"
              />
              <text
                x={x}
                y="252"
                textAnchor="middle"
                fill="#BFD3FF"
                fontSize="10"
                fontFamily="Inter, sans-serif"
              >
                {label}
              </text>
            </g>
          ))}
        </svg>
        <span className="sv-packet" style={{ offsetPath: "path('M206 98 L86 170')" }} />
        <span
          className="sv-packet"
          style={{ offsetPath: "path('M206 98 L206 170')", animationDelay: "1s" }}
        />
        <span
          className="sv-packet"
          style={{ offsetPath: "path('M206 98 L326 170')", animationDelay: "2s" }}
        />
      </div>
    </div>
  );
}

// 04 · IA: chat del asistente
function AiMockup() {
  return (
    <div aria-hidden="true" className={`${stage} bg-background`}>
      <span className="fx-ring absolute top-[calc(50%-130px)] left-[calc(50%-130px)] size-[260px] rounded-full bg-[conic-gradient(from_0deg,#1a66f5,#050b1c,#4d8bff,#050b1c,#1a66f5)] opacity-55 blur-[46px]" />
      <div className="relative w-[340px] max-w-[88%] overflow-hidden rounded-[14px] border border-white/[0.16] bg-[rgba(8,17,38,0.82)]">
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-3.5 py-2.5">
          <span className="fx-dot flex size-[26px] items-center justify-center rounded-full bg-accent">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="text-xs font-semibold">Asistente IA</span>
            <span className="text-[10px] text-accent-softer">En línea</span>
          </span>
        </div>
        <div className="flex min-h-[168px] flex-col gap-2.5 p-3.5">
          <span className="ia-u max-w-[75%] self-end rounded-[12px_12px_4px_12px] bg-accent px-3 py-2 text-xs leading-[1.4] text-white">
            ¿Tienen turno para mañana?
          </span>
          <div className="grid justify-items-start">
            <span className="ia-t inline-flex gap-1 rounded-[12px_12px_12px_4px] bg-surface-4 px-3 py-2.5 [grid-area:1/1]">
              {[0, 0.15, 0.3].map((d) => (
                <span
                  key={d}
                  className="ia-dot size-[5px] rounded-full bg-accent-pale"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </span>
            <span className="ia-r max-w-[80%] rounded-[12px_12px_12px_4px] bg-surface-4 px-3 py-2 text-xs leading-[1.4] text-text-strong [grid-area:1/1]">
              ¡Sí! Hay lugar a las 10 y a las 15 h. ¿Te reservo uno?
            </span>
          </div>
          <span className="ia-c inline-flex items-center gap-1.5 self-start rounded-full border border-accent-light/55 bg-accent/15 px-2.5 py-[5px] text-[11px] font-semibold text-accent-pale">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Turno reservado automáticamente
          </span>
        </div>
      </div>
    </div>
  );
}

const mockups: Record<Service["slug"], ReactNode> = {
  "desarrollo-web": <WebMockup />,
  "sistemas-a-medida": <SystemsMockup />,
  "desarrollo-saas": <SaasMockup />,
  "inteligencia-artificial": <AiMockup />,
};

export function Services() {
  return (
    <section
      id="servicios"
      className="relative overflow-hidden bg-background px-6 py-28 text-white"
    >
      <div
        aria-hidden="true"
        className="fx-orb fx-orb2 -top-50 left-[30%] size-[480px] bg-accent/[0.22]"
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[640px] flex-col gap-4">
            <span className="text-[13px] font-semibold tracking-[0.12em] text-accent-soft uppercase">
              Servicios
            </span>
            <h2 className="m-0 font-display text-[clamp(32px,3.8vw,50px)] leading-[1.05] font-bold tracking-[-0.025em]">
              Todo lo que necesitás para crecer en digital
            </h2>
          </div>
          <p className="m-0 max-w-[420px] text-[17px] leading-[1.6] text-text-muted">
            Desde tu primera web hasta un producto propio con inteligencia
            artificial. Elegí un servicio para ver qué incluye.
          </p>
        </div>

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] gap-6 p-0">
          {services.map((service, i) => (
            <li key={service.slug} className={`fx-reveal r${(i % 2) + 1} flex`}>
              <Link
                href={`/servicios/${service.slug}`}
                className={`fx-card flex flex-1 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-surface-3 text-white no-underline ${
                  service.isNew ? "fx-beam" : ""
                }`}
              >
                {mockups[service.slug]}
                <div className="flex flex-col gap-2.5 px-8 pt-7 pb-8">
                  <h3 className="m-0 flex items-center gap-2.5 font-display text-[22px] font-semibold">
                    {service.title}
                    {service.isNew && (
                      <span className="rounded-full border border-accent-light/60 bg-accent/35 px-[9px] py-[3px] text-[11px] font-semibold text-white">
                        Nuevo
                      </span>
                    )}
                    <ArrowRight className="fx-arrow text-accent-soft" />
                  </h3>
                  <p className="m-0 text-[15px] leading-[1.6] text-text-muted">
                    {service.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
