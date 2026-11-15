"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthForm } from "./auth-form";
import { inputClass, labelClass } from "./field-styles";
import { signUpAction } from "@/app/cuenta/actions";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";

export function RegisterForm() {
  const [password, setPassword] = useState("");

  return (
    <AuthForm
      action={signUpAction}
      title="Crear cuenta"
      subtitle="Completá tus datos para empezar a participar."
      submitLabel="Crear cuenta"
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/cuenta/login" className="font-semibold text-accent no-underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <label className={labelClass}>
        Nombre y apellido
        <input
          type="text"
          name="name"
          required
          placeholder="Cómo querés que te vean en los comentarios"
          autoComplete="name"
          className={inputClass}
        />
      </label>
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
      <PasswordInput
        name="password"
        required
        minLength={8}
        placeholder="Creá una contraseña"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordStrength password={password} />
      {/* Términos y Privacidad aún no tienen página: se ven como link, sin destino. */}
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-normal text-[#2B3449]">
        <input type="checkbox" name="terms" required className="au-check mt-0.5 flex-none" />
        <span>
          Acepto los <span className="font-semibold text-accent">Términos y condiciones</span> y
          la <span className="font-semibold text-accent">Política de privacidad</span>.
        </span>
      </label>
    </AuthForm>
  );
}
