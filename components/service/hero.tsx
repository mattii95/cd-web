import Link from "next/link";
import { ArrowRight, serviceIcons } from "@/components/icons";
import { services, type Service } from "@/lib/services";

const gridBg =
  "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]";

export function ServiceHero({ service }: { service: Service }) {
  const Icon = serviceIcons[service.icon];
  const number = String(services.indexOf(service) + 1).padStart(2, "0");

  return (
    <section className="relative overflow-hidden bg-background text-white">
      {/* Fondo decorativo */}
      <div aria-hidden="true" className={`fx-grid absolute inset-0 ${gridBg}`} />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 top-5 -right-25 size-[520px] bg-accent/45"
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb2 top-[300px] -left-35 size-[380px] bg-accent-light/20"
      />
      <div
        aria-hidden="true"
        className="fx-ring absolute top-20 -right-35 size-[520px] rounded-full border border-dashed border-accent-light/35"
      >
        <span className="absolute -top-[5px] left-1/2 size-2.5 rounded-full bg-accent-light shadow-[0_0_16px_4px_rgba(77,139,255,0.8)]" />
      </div>

      {/* pt: 92px de header (absoluto) + 56px de aire */}
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-14 px-6 pt-[148px] pb-26">
        <div className="flex flex-col gap-[26px]">
          <nav
            aria-label="Breadcrumb"
            className="fx-rise d1 text-sm text-text-muted"
          >
            <Link href="/#servicios" className="text-text-muted no-underline hover:text-white">
              Servicios
            </Link>{" "}
            / <span className="text-white">{service.title}</span>
          </nav>

          <h1 className="fx-rise d2 m-0 font-display text-[clamp(38px,5vw,62px)] leading-[1.04] font-bold tracking-[-0.03em]">
            {service.headline}
          </h1>
          <p className="fx-rise d3 m-0 max-w-[540px] text-lg leading-[1.6] text-text-muted">
            {service.intro}
          </p>

          <div className="fx-rise d4 flex flex-wrap gap-3">
            <Link
              href={`/?servicio=${service.slug}#contacto`}
              className="fx-btn inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-accent px-[26px] py-4 text-base font-semibold text-white no-underline"
            >
              Quiero este servicio
              <ArrowRight size={18} />
            </Link>
            <a
              href="#incluye"
              className="fx-ghost inline-flex min-h-[52px] items-center rounded-full border border-white/[0.22] px-[26px] py-4 text-base font-semibold text-white no-underline"
            >
              Qué incluye
            </a>
          </div>
        </div>

        <div className="fx-rise d3">
          <div className="fx-float fx-beam relative flex flex-col gap-7 overflow-hidden rounded-[28px] border border-white/10 bg-surface-2 p-10 shadow-[0_40px_80px_rgba(0,0,0,0.4),0_0_90px_rgba(26,102,245,0.28)]">
            <span aria-hidden="true" className="fx-scan" />
            <div className="flex items-start justify-between">
              <span className="fx-dot flex size-22 items-center justify-center rounded-3xl bg-accent text-white shadow-[0_20px_40px_rgba(26,102,245,0.4)]">
                <Icon size={42} />
              </span>
              <span
                aria-hidden="true"
                className="fx-glowtext font-display text-[72px] leading-[0.9] font-bold text-[#2e4372]"
              >
                {number}
              </span>
            </div>
            <strong className="font-display text-[30px] font-semibold tracking-[-0.01em]">
              {service.title}
            </strong>
            <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
              {service.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-white/12 bg-white/[0.07] px-3.5 py-2 text-sm font-medium text-text"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
