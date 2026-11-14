import type { ReactNode } from "react";
import Image from "next/image";
import { Bolt, Chat, Clock, Refresh } from "@/components/icons";
import { site } from "@/lib/site";

const differentials = [
  { Icon: Chat, title: "Trato directo", text: "Hablás con quien hace tu proyecto." },
  { Icon: Bolt, title: "Tecnología actual", text: "Herramientas modernas, rápidas y seguras." },
  { Icon: Clock, title: "Plazos claros", text: "Sabés qué se entrega y cuándo." },
  { Icon: Refresh, title: "Largo plazo", text: "Seguimos a tu lado después del lanzamiento." },
];

const key = (name: string) => <span className="text-accent-softer">{name}</span>;
const str = (value: string) => <span className="text-accent-pale">{value}</span>;

// Líneas del bloque de código. `desde` se omite si foundedYear es 0.
function codeLines(): ReactNode[] {
  return [
    <><span className="text-accent-light">const</span> equipo = {"{"}</>,
    <>&nbsp;&nbsp;{key("marca")}: {str(`"${site.name}"`)},</>,
    ...(site.foundedYear > 0
      ? [<>&nbsp;&nbsp;{key("desde")}: <span className="text-white">{site.foundedYear}</span>,</>]
      : []),
    <>&nbsp;&nbsp;{key("base")}: {str('"Argentina"')},</>,
    <>
      &nbsp;&nbsp;{key("servicios")}: [{str('"web"')}, {str('"sistemas"')}, {str('"SaaS"')}, {str('"IA"')}],
    </>,
    <>&nbsp;&nbsp;{key("misión")}: {str('"que tu negocio crezca"')}</>,
    <>
      {"};"}
      <span className="fx-caret ml-1.5 inline-block h-[1.1em] w-[0.55em] bg-accent-light align-middle shadow-[0_0_12px_rgba(77,139,255,0.9)]" />
    </>,
  ];
}

const dots = (
  <>
    <span className="size-2.5 rounded-full bg-border-strong" />
    <span className="size-2.5 rounded-full bg-border-strong" />
    <span className="size-2.5 rounded-full bg-border-strong" />
  </>
);

export function About() {
  const lines = codeLines();

  return (
    <section
      id="nosotros"
      className="relative overflow-hidden bg-paper px-6 py-28 text-surface"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(rgba(11,18,34,0.09)_1px,transparent_1px)] bg-[size:24px_24px]"
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 top-20 -left-35 size-[420px] bg-accent/[0.14]"
      />

      <div className="relative mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-16">
        {/* Tarjeta de código */}
        <div className="fx-reveal relative">
          <div className="fx-beam fx-float relative overflow-hidden rounded-[18px] border border-white/[0.12] bg-surface-3 shadow-[0_40px_80px_rgba(11,18,34,0.25),0_0_60px_rgba(26,102,245,0.18)]">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3.5">
              {dots}
              <span className="ml-3 font-mono text-xs text-text-muted">nosotros.js</span>
            </div>
            <div
              role="img"
              aria-label="Fragmento de código que describe al equipo de Courroux Digital"
              className="overflow-x-auto px-6 pt-6 pb-7 font-mono text-[15px] leading-loose text-text"
            >
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="fx-line whitespace-nowrap"
                  style={{ animationRange: `entry ${i * 5}% cover ${30 + i * 3}%` }}
                >
                  <span className="mr-[18px] text-text-subtle">{i + 1}</span>
                  {line}
                </div>
              ))}
            </div>
          </div>

          {site.projectsDelivered > 0 && (
            <div className="fx-float2 absolute -right-3 -bottom-7 flex items-center gap-3.5 rounded-2xl border border-accent-light/45 bg-surface-3/90 px-5 py-4 text-white shadow-[0_20px_40px_rgba(11,18,34,0.25),0_0_30px_rgba(26,102,245,0.25)]">
              <Image src="/cd-sin-fondo.png" alt="" width={40} height={40} className="size-10 rounded-[10px]" />
              <span className="flex flex-col gap-0.5">
                <strong className="font-display text-xl">+{site.projectsDelivered} proyectos</strong>
                <span className="text-[13px] text-text-muted">
                  {site.foundedYear > 0 ? `entregados desde ${site.foundedYear}` : "entregados"}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Texto y diferenciales */}
        <div className="flex flex-col gap-[22px]">
          <span className="fx-reveal font-mono text-[13px] font-medium text-accent">{"// sobre nosotros"}</span>
          <h2 className="fx-reveal m-0 font-display text-[clamp(32px,3.8vw,50px)] leading-[1.05] font-bold tracking-[-0.025em]">
            Un equipo que combina código, producto e inteligencia artificial.
          </h2>
          <p className="fx-reveal m-0 text-[17px] leading-[1.7] text-text-faint">
            [Contá acá la historia de tu emprendimiento: quiénes son y cómo empezaron.]
            Trabajamos con emprendedores, pymes y empresas que quieren usar la tecnología
            para vender más, ordenar sus procesos o lanzar su propio producto digital.
          </p>
          <ul className="m-0 mt-1.5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3.5 p-0">
            {differentials.map(({ Icon, title, text }, i) => (
              <li key={title} className={`fx-reveal r${i + 1} flex`}>
                <div className="fx-card flex flex-1 items-start gap-3.5 rounded-2xl border border-paper-border bg-white p-[18px]">
                  <span className="fx-icon flex size-9 flex-none items-center justify-center rounded-[10px] bg-accent-tint text-accent">
                    <Icon />
                  </span>
                  <span className="flex flex-col gap-1">
                    <strong className="text-base">{title}</strong>
                    <span className="text-sm leading-normal text-text-faint">{text}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
