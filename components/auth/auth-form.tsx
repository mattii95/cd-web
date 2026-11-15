"use client";

import { type ReactNode, useActionState } from "react";
import type { FormState } from "@/app/cuenta/actions";
import { ArrowRight } from "@/components/icons";
import { FormMessage } from "./form-message";

// La validación nativa corre en el navegador y Zod la repite en la Server Action.
export function AuthForm({
  action,
  title,
  subtitle,
  submitLabel,
  footer,
  children,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  title: string;
  subtitle: string;
  submitLabel: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  return (
    <form
      action={formAction}
      className="fx-reveal relative flex w-full max-w-[440px] flex-col gap-[18px]"
    >
      <div className="mb-1.5 flex flex-col gap-2">
        <h2 className="m-0 font-display text-[34px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="m-0 text-[15px] leading-normal text-text-faint">{subtitle}</p>
      </div>
      {children}
      <FormMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="fx-btn mt-1 flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 bg-accent disabled:cursor-wait disabled:opacity-70 text-base font-semibold text-white"
      >
        {submitLabel}
        <ArrowRight size={18} />
      </button>
      <p className="m-0 mt-1.5 text-center text-[15px] text-text-faint">{footer}</p>
    </form>
  );
}
