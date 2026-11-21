"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { resendVerificationAction } from "@/actions/cuenta";
import { AuthForm } from "./auth-form";
import { AuthNotice } from "./auth-notice";
import { inputClass, labelClass } from "./field-styles";

const loginLink = (
  <Link href="/cuenta/login" className="font-semibold text-accent no-underline">
    Volver a iniciar sesión
  </Link>
);

function ResendForm({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <AuthForm
      action={resendVerificationAction}
      title={title}
      subtitle={subtitle}
      submitLabel="Reenviar link"
      captcha
      footer={loginLink}
    >
      <label className={labelClass}>
        Email
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          autoComplete="email"
          className={inputClass}
        />
      </label>
    </AuthForm>
  );
}

const pending = (
  <ResendForm
    title="Revisá tu email"
    subtitle="Te mandamos un link para verificar tu cuenta. Vence en 24 horas. Si no te llegó, pedí otro."
  />
);

function View() {
  const params = useSearchParams();
  if (params.get("error")) {
    return (
      <ResendForm
        title="El link venció o no es válido"
        subtitle="Pedí uno nuevo con tu email y te lo mandamos de nuevo."
      />
    );
  }
  if (params.get("estado") === "ok") {
    return (
      <AuthNotice
        title="Tu email está verificado"
        text="Tu cuenta ya está activa. Iniciá sesión para empezar."
        href="/cuenta/login"
        label="Ir a iniciar sesión"
      />
    );
  }
  return pending;
}

// useSearchParams exige <Suspense> con cacheComponents para que la página se prerenderice.
export function VerifyView() {
  return (
    <Suspense fallback={pending}>
      <View />
    </Suspense>
  );
}
