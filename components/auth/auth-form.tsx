"use client";

import { type ReactNode, useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/actions/cuenta";
import { ArrowRight } from "@/components/icons";
import { FormMessage } from "./form-message";
import { Turnstile, type TurnstileHandle } from "./turnstile";

// La validación nativa corre en el navegador y Zod la repite en la Server Action.
export function AuthForm({
  action,
  title,
  subtitle,
  submitLabel,
  footer,
  social,
  captcha,
  children,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  title: string;
  subtitle: string;
  submitLabel: string;
  footer: ReactNode;
  // Va fuera del <form> de email: los botones de proveedor tienen su propio form y no se anidan.
  social?: ReactNode;
  // Monta Turnstile y bloquea el envío hasta que haya token.
  captcha?: boolean;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  // El token se gasta en cada envío, salga bien o mal: hay que pedir otro.
  useEffect(() => {
    if (state.status !== "idle") turnstile.current?.reset();
  }, [state]);

  return (
    <div className="fx-reveal relative flex w-full max-w-[440px] flex-col gap-[18px]">
      <div className="mb-1.5 flex flex-col gap-2">
        <h2 className="m-0 font-display text-[34px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="m-0 text-[15px] leading-normal text-text-faint">{subtitle}</p>
      </div>
      {social}
      <form action={formAction} className="flex flex-col gap-[18px]">
        {children}
        {captcha && <Turnstile ref={turnstile} onToken={setToken} />}
        <FormMessage state={state} />
        <button
          type="submit"
          disabled={pending || (captcha && !token)}
          aria-busy={pending}
          className="fx-btn mt-1 flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 bg-accent disabled:cursor-wait disabled:opacity-70 text-base font-semibold text-white"
        >
          {submitLabel}
          <ArrowRight size={18} />
        </button>
      </form>
      <p className="m-0 mt-1.5 text-center text-[15px] text-text-faint">{footer}</p>
    </div>
  );
}
