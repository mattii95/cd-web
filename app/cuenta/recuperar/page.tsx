import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthPanel } from "@/components/auth/auth-panel";
import { RecoverForm } from "@/components/auth/recover-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Pedí un link para crear una contraseña nueva en tu cuenta del blog.",
  alternates: { canonical: "/cuenta/recuperar" },
  robots: { index: false, follow: true },
};

export default function RecoverPage() {
  return (
    <AuthLayout
      panel={
        <AuthPanel
          prompt="$ recuperar --contraseña"
          title="Volvé a entrar en un minuto"
          intro="Te mandamos un link a tu email para que crees una contraseña nueva."
          checks={[
            "Link válido por 1 hora",
            "Tu cuenta sigue segura",
            "Sin perder tus comentarios",
          ]}
        />
      }
    >
      <RecoverForm />
    </AuthLayout>
  );
}
