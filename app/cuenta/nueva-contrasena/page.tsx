import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthPanel } from "@/components/auth/auth-panel";
import { NewPasswordView } from "@/components/auth/new-password-view";

export const metadata: Metadata = {
  title: "Contraseña nueva",
  description: "Elegí una contraseña nueva para tu cuenta del blog.",
  alternates: { canonical: "/cuenta/nueva-contrasena" },
  robots: { index: false, follow: false },
};

export default function NewPasswordPage() {
  return (
    <AuthLayout
      panel={
        <AuthPanel
          prompt="$ contraseña --nueva"
          title="Elegí una contraseña nueva"
          intro="Al guardarla cerramos las sesiones abiertas de tu cuenta, así queda todo seguro."
          checks={[
            "Mínimo 8 caracteres",
            "Cerramos las otras sesiones",
            "Después iniciás sesión de nuevo",
          ]}
        />
      }
    >
      <NewPasswordView />
    </AuthLayout>
  );
}
