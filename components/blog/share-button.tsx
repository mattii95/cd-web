"use client";

import { useState } from "react";

export function ShareButton({ title }: { title: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      // Cancelar el panel del sistema rechaza la promesa: no es un error.
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold text-text-faint">
        Compartir
      </span>
      <button
        type="button"
        onClick={share}
        className="fx-card inline-flex min-h-11 cursor-pointer items-center gap-2.5 self-start rounded-xl border border-paper-border bg-white px-4 text-sm font-semibold text-[#2b3449]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" />
        </svg>
        Compartir artículo
      </button>
      <span role="status" className="min-h-5 text-[13px] text-accent">
        {status === "copied" && "Link copiado"}
        {status === "error" && "No se pudo copiar"}
      </span>
    </div>
  );
}
