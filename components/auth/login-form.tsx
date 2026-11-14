import Link from "next/link";
import { AuthForm } from "./auth-form";
import { inputClass, labelClass } from "./field-styles";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  return (
    <AuthForm
      title="Iniciá sesión"
      subtitle="Bienvenido de nuevo. Ingresá con tu cuenta para participar."
      submitLabel="Ingresar"
      footer={
        <>
          ¿No tenés cuenta?{" "}
          <Link href="/cuenta/registro" className="font-semibold text-accent no-underline">
            Creá una gratis
          </Link>
        </>
      }
    >
      <GoogleButton />
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
        placeholder="Tu contraseña"
        autoComplete="current-password"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Solo visual: "Recordarme" no hace nada hasta tener sesiones. */}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#2B3449]">
          <input type="checkbox" className="au-check" />
          Recordarme
        </label>
        <Link
          href="/cuenta/recuperar"
          className="py-3 text-sm font-semibold text-accent no-underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </AuthForm>
  );
}
