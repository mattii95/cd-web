import Link from "next/link";
import { ArrowRight, serviceIcons } from "@/components/icons";
import { services, type Service } from "@/lib/services";

export function OtherServices({ current }: { current: Service }) {
  return (
    <section className="bg-white px-6 pb-24 text-ink">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7">
        <h2 className="m-0 font-display text-[28px] font-bold tracking-[-0.01em]">
          Otros servicios
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5 p-0">
          {services.map((s, i) => {
            if (s === current) return null;
            const Icon = serviceIcons[s.icon];
            return (
              <li key={s.slug} className="flex">
                <Link
                  href={`/servicios/${s.slug}`}
                  className="fx-card flex flex-1 items-center gap-4 rounded-[20px] border border-paper-border bg-white p-6 text-ink no-underline"
                >
                  <span className="fx-icon flex size-12 flex-none items-center justify-center rounded-[14px] bg-accent-tint text-accent">
                    <Icon size={22} />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-xs font-semibold text-text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <strong className="font-display text-lg font-semibold">
                      {s.title}
                    </strong>
                  </span>
                  <span className="fx-arrow text-accent">
                    <ArrowRight size={18} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
