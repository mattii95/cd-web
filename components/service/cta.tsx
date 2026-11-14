import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import type { Service } from "@/lib/services";

export function ServiceCta({ service }: { service: Service }) {
  return (
    <section className="bg-white px-6 pb-24">
      <div className="fx-reveal fx-beam relative mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 overflow-hidden rounded-[32px] bg-background p-[clamp(32px,5vw,64px)] text-white">
        <div
          aria-hidden="true"
          className="fx-orb fx-orb1 -top-40 -right-20 size-[360px] bg-accent/45"
        />
        <div
          aria-hidden="true"
          className="fx-ring absolute -top-40 -right-25 size-[400px] rounded-full border border-dashed border-accent-light/40"
        />
        <div className="relative flex max-w-[620px] flex-col gap-3">
          <h2 className="m-0 font-display text-[clamp(30px,3.4vw,44px)] leading-[1.08] font-bold tracking-[-0.02em]">
            ¿Hablamos de tu proyecto?
          </h2>
          <p className="m-0 text-[17px] leading-[1.6] text-text-muted">
            Contanos tu idea y te enviamos una propuesta sin compromiso.
          </p>
        </div>
        <Link
          href={`/?servicio=${service.slug}#contacto`}
          className="fx-btn relative inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-accent px-7 py-4 text-base font-semibold text-white no-underline"
        >
          Pedí tu presupuesto
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
