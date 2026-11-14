"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { ArrowRight } from "@/components/icons";
import { UnavailableNotice } from "./unavailable-notice";

// Todavía no hay cuentas: si la validación nativa pasa, no navega y muestra el aviso.
export function AuthForm({
  title,
  subtitle,
  submitLabel,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="fx-reveal relative flex w-full max-w-[440px] flex-col gap-[18px]"
    >
      <div className="mb-1.5 flex flex-col gap-2">
        <h2 className="m-0 font-display text-[34px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="m-0 text-[15px] leading-normal text-text-faint">{subtitle}</p>
      </div>
      {children}
      {submitted && <UnavailableNotice />}
      <button
        type="submit"
        className="fx-btn mt-1 flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 bg-accent text-base font-semibold text-white"
      >
        {submitLabel}
        <ArrowRight size={18} />
      </button>
      <p className="m-0 mt-1.5 text-center text-[15px] text-text-faint">{footer}</p>
    </form>
  );
}
