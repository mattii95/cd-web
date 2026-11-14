import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check } from "@/components/icons";
import { site } from "@/lib/site";

export type AuthPanelContent = {
  prompt: string; // "$ login --lector"
  title: string; // h1: "Sumate a la conversación del blog"
  intro: string; // bajada
  checks: [string, string, string]; // los 3 ítems con check
};

export function AuthPanel({ prompt, title, intro, checks }: AuthPanelContent) {
  return (
    <aside className="relative flex flex-col justify-between gap-12 overflow-hidden bg-background p-[clamp(28px,4vw,56px)] text-white">
      <div
        className="fx-grid absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]"
        aria-hidden="true"
      />
      <div
        className="fx-orb fx-orb1 -right-[140px] top-[120px] size-[460px] bg-accent/45"
        aria-hidden="true"
      />
      <div
        className="fx-ring absolute -right-[180px] top-[60px] size-[480px] rounded-full border border-dashed border-accent-light/35"
        aria-hidden="true"
      >
        <span className="absolute -top-[5px] left-1/2 size-2.5 rounded-full bg-accent-light shadow-[0_0_16px_4px_rgba(77,139,255,0.8)]" />
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <Image
            src="/cd-sin-fondo.png"
            alt=""
            width={44}
            height={44}
            priority
            className="block size-11"
          />
          <span className="font-display text-[19px] font-bold">{site.name}</span>
        </Link>
        <Link
          href="/blog"
          className="fx-ghost inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.16] px-4 py-2.5 text-sm font-medium text-text no-underline"
        >
          <ArrowLeft />
          Volver al blog
        </Link>
      </div>

      <div className="relative flex max-w-[520px] flex-col gap-[22px]">
        <span className="fx-rise d1 font-mono text-sm text-accent-soft">{prompt}</span>
        <h1 className="fx-rise d2 m-0 font-display text-[clamp(36px,4.2vw,56px)] leading-[1.04] font-bold tracking-[-0.03em]">
          {title}
        </h1>
        <p className="fx-rise d3 m-0 text-[17px] leading-[1.6] text-text-muted">{intro}</p>

        <div className="fx-rise d4 relative mt-3 pb-14" aria-hidden="true">
          <div className="fx-float fx-beam relative flex max-w-[420px] gap-3.5 rounded-2xl border border-white/[0.14] bg-surface-3/90 px-5 py-[18px] shadow-[0_30px_60px_rgba(0,0,0,0.45),0_0_50px_rgba(26,102,245,0.2)]">
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-accent text-sm font-bold">
              VS
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">Vos</strong>
                <span className="text-base tracking-[2px] text-accent-light [text-shadow:0_0_10px_rgba(77,139,255,0.8)]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="au-star" style={{ animationDelay: `${i * 0.12}s` }}>
                      ★
                    </span>
                  ))}
                </span>
              </div>
              <span className="au-type block overflow-hidden font-mono text-sm whitespace-nowrap text-text">
                ¡Muy útil, lo voy a aplicar!
              </span>
            </div>
          </div>
          <div className="fx-float2 absolute right-0 bottom-0 flex items-center gap-2.5 rounded-[14px] bg-white px-4 py-3 text-ink shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
            <Image
              src="/cd-sin-fondo.png"
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full"
            />
            <span className="text-[13px]">
              <strong>El autor</strong> respondió tu comentario
            </span>
          </div>
        </div>
      </div>

      <ul className="relative m-0 flex list-none flex-col gap-3 p-0">
        {checks.map((text) => (
          <li key={text} className="flex items-center gap-3 text-[15px] text-text">
            <span className="flex size-[26px] flex-none items-center justify-center rounded-full border border-accent-light/50 bg-accent/25 text-accent-pale">
              <Check size={14} strokeWidth={3} />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
