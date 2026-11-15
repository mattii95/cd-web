"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { resetPasswordAction } from "@/app/cuenta/actions";
import { AuthForm } from "./auth-form";
import { AuthNotice } from "./auth-notice";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";

function NewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  return (
    <AuthForm
      action={resetPasswordAction}
      title="Elegí una contraseña nueva"
      subtitle="Usá al menos 8 caracteres. Al guardarla, cerramos tus otras sesiones."
      submitLabel="Guardar contraseña"
      footer={null}
    >
      <input type="hidden" name="token" value={token} />
      <PasswordInput
        label="Contraseña nueva"
        name="password"
        required
        minLength={8}
        placeholder="Creá una contraseña"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordStrength password={password} />
    </AuthForm>
  );
}

const invalid = (
  <AuthNotice
    title="El link venció o no es válido"
    text="Los links de recuperación duran 1 hora y se usan una sola vez. Pedí uno nuevo."
    href="/cuenta/recuperar"
    label="Pedir un link nuevo"
  />
);

function View() {
  const params = useSearchParams();
  const token = params.get("token");
  if (!token || params.get("error")) return invalid;
  return <NewPasswordForm token={token} />;
}

// useSearchParams exige <Suspense> con cacheComponents para que la página se prerenderice.
export function NewPasswordView() {
  return (
    <Suspense fallback={invalid}>
      <View />
    </Suspense>
  );
}
