import Link from "next/link";
import { requestResetAction } from "@/actions/cuenta";
import { AuthForm } from "./auth-form";
import { inputClass, labelClass } from "./field-styles";

export function RecoverForm() {
  return (
    <AuthForm
      action={requestResetAction}
      title="Recuperá tu contraseña"
      subtitle="Te enviamos un link para crear una nueva."
      submitLabel="Enviar link"
      captcha
      footer={
        <>
          ¿Te acordaste?{" "}
          <Link href="/cuenta/login" className="font-semibold text-accent no-underline">
            Iniciá sesión
          </Link>
        </>
      }
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
