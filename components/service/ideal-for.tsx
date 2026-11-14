import { Check } from "@/components/icons";
import type { Service } from "@/lib/services";

export function ServiceIdealFor({ service }: { service: Service }) {
  return (
    <section className="bg-white px-6 pb-24 text-ink">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-12">
        <div className="flex flex-col gap-3.5">
          <span className="text-[13px] font-semibold tracking-[0.12em] text-accent uppercase">
            Ideal para
          </span>
          <h2 className="m-0 font-display text-[clamp(30px,3.4vw,44px)] leading-[1.08] font-bold tracking-[-0.02em]">
            ¿Es para vos?
          </h2>
          <p className="m-0 text-[17px] leading-[1.6] text-text-faint">
            Si te identificás con alguno de estos casos, podemos ayudarte.
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {service.idealFor.map((item, i) => (
            <li key={item} className={`fx-revealx r${i + 1} flex`}>
              <div className="fx-row flex flex-1 items-center gap-3.5 rounded-2xl border border-paper-border bg-white px-5 py-[18px] text-base font-medium">
                <span className="fx-pop flex size-[30px] flex-none items-center justify-center rounded-full bg-accent text-white">
                  <Check size={18} strokeWidth={2.6} />
                </span>
                {item}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
