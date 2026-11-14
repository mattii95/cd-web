"use client";

import type { FormEvent } from "react";
import { ArrowRight } from "@/components/icons";
import { services } from "@/lib/services";
import { site } from "@/lib/site";

const serviceOptions = [
  ...services.map((s) => s.title),
  "Todavía no lo sé",
];

const label = "flex flex-col gap-2 text-sm font-semibold text-text";
const field =
  "fx-input w-full min-h-12 rounded-xl border border-white/[0.16] bg-background px-3.5 py-[13px] text-[15px] font-normal text-white";

export function ContactForm() {
  // Sin backend: arma el mensaje y abre WhatsApp en una pestaña nueva.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const service = String(data.get("service") ?? "");
    const message = String(data.get("message") ?? "").trim();

    const text = [
      `Hola, soy ${name}.`,
      `Email: ${email}`,
      `Servicio: ${service}`,
      "",
      message,
    ].join("\n");

    window.open(
      `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="fx-beam relative flex flex-col gap-[18px] rounded-3xl border border-white/[0.12] bg-surface-3/85 p-8 shadow-[0_40px_80px_rgba(0,0,0,0.45),0_0_80px_rgba(26,102,245,0.18)]"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3.5 font-mono text-xs text-text-muted">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-2">nuevo-proyecto.form</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-4">
        <label className={label}>
          Nombre
          <input
            className={field}
            type="text"
            name="name"
            placeholder="Tu nombre"
            autoComplete="name"
            required
          />
        </label>
        <label className={label}>
          Email
          <input
            className={field}
            type="email"
            name="email"
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
        </label>
      </div>

      <label className={label}>
        ¿Qué servicio te interesa?
        <select className={field} name="service" defaultValue={serviceOptions[0]}>
          {serviceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        Contanos tu proyecto
        <textarea
          className={`${field} resize-y`}
          name="message"
          rows={4}
          placeholder="¿Qué necesitás resolver?"
          required
        />
      </label>

      <button
        type="submit"
        className="fx-btn inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-full border-0 bg-accent px-6 py-[15px] text-base font-semibold text-white"
      >
        Enviar consulta
        <ArrowRight />
      </button>
    </form>
  );
}
