const gridBg =
  "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]";

export const blogIntro =
  "Guías prácticas sobre webs, sistemas, productos SaaS e inteligencia artificial, escritas sin vueltas ni tecnicismos.";

export function BlogHero() {
  return (
    <section className="relative overflow-hidden bg-background text-white">
      <div
        aria-hidden="true"
        className={`fx-grid absolute inset-0 ${gridBg}`}
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 top-5 -right-25 size-[520px] bg-accent/45"
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb2 top-[300px] -left-35 size-[380px] bg-accent-light/20"
      />
      {/* pt: 92px de header (absoluto) + 56px de aire */}
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-6 px-6 pt-[148px] pb-24">
        <span className="fx-rise d1 font-mono text-sm text-accent-soft">
          {"// blog"}
        </span>
        <h1 className="fx-rise d2 m-0 max-w-[900px] font-display text-[clamp(40px,5.6vw,72px)] leading-[1.02] font-bold tracking-[-0.03em]">
          Tecnología explicada{" "}
          <span className="fx-glowtext text-accent-light">
            para hacer crecer tu negocio
          </span>
        </h1>
        <p className="fx-rise d3 m-0 max-w-[620px] text-lg leading-[1.6] text-text-muted">
          {blogIntro}
        </p>
        {/* Solo visual: no filtra (ver spec 03). */}
        <label className="fx-rise d4 relative flex max-w-[520px] flex-col gap-2 text-[13px] font-semibold text-text">
          Buscar artículos
          <input
            type="search"
            placeholder="Ej: chatbot, sistema de gestión, SEO…"
            className="fx-input min-h-[54px] rounded-full border border-white/[0.18] bg-white/5 py-[15px] pr-[18px] pl-12 text-base font-normal text-white"
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="absolute bottom-[17px] left-[18px] text-text-subtle"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
        </label>
      </div>
    </section>
  );
}
