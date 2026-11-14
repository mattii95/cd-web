import { Check } from "@/components/icons";
import type { Service } from "@/lib/services";

export function ServiceFeatures({ service }: { service: Service }) {
  return (
    <section id="incluye" className="scroll-mt-4 bg-paper px-6 py-24 text-ink">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex max-w-[620px] flex-col gap-3.5">
          <span className="text-[13px] font-semibold tracking-[0.12em] text-accent uppercase">
            Qué incluye
          </span>
          <h2 className="m-0 font-display text-[clamp(30px,3.4vw,44px)] leading-[1.08] font-bold tracking-[-0.02em]">
            Todo lo que necesitás, en un mismo equipo
          </h2>
        </div>

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5 p-0">
          {service.features.map((f, i) => (
            <li key={f.title} className={`fx-reveal r${(i % 3) + 1} flex`}>
              <div className="fx-card flex flex-1 flex-col gap-3 rounded-[20px] border border-paper-border bg-white p-7">
                <span className="fx-icon flex size-9 items-center justify-center rounded-full bg-accent-tint text-accent">
                  <Check size={18} strokeWidth={2.6} />
                </span>
                <h3 className="m-0 font-display text-[19px] font-semibold">
                  {f.title}
                </h3>
                <p className="m-0 text-[15px] leading-[1.6] text-text-faint">
                  {f.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
