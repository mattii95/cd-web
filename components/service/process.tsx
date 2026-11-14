import { processSteps } from "@/lib/services";

export function ServiceProcess() {
  return (
    <section className="bg-white px-6 py-24 text-ink">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex max-w-[620px] flex-col gap-3.5">
          <span className="text-[13px] font-semibold tracking-[0.12em] text-accent uppercase">
            Cómo trabajamos
          </span>
          <h2 className="m-0 font-display text-[clamp(30px,3.4vw,44px)] leading-[1.08] font-bold tracking-[-0.02em]">
            Un proceso simple y transparente
          </h2>
        </div>

        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-7 p-0">
          {processSteps.map((step, i) => (
            <li
              key={step.title}
              className={`fx-reveal r${i + 1} relative flex flex-col gap-3.5 border-t-2 border-[#d5deee] pt-6`}
            >
              <span
                aria-hidden="true"
                className={`fx-fill r${i + 1} absolute inset-x-0 -top-0.5 h-0.5 bg-accent shadow-[0_0_12px_rgba(77,139,255,0.9)]`}
              />
              <span
                aria-hidden="true"
                className="fx-pop absolute -top-[7px] left-0 size-3 rounded-full bg-accent shadow-[0_0_14px_2px_rgba(77,139,255,0.9)]"
              />
              <span className="font-display text-[15px] font-bold text-accent">
                Paso {i + 1}
              </span>
              <h3 className="m-0 font-display text-[21px] font-semibold">
                {step.title}
              </h3>
              <p className="m-0 text-[15px] leading-[1.6] text-text-faint">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
