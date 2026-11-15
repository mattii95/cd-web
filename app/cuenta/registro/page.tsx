import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthPanel } from "@/components/auth/auth-panel";
import { SocialSection } from "@/components/auth/social-section";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Creá tu cuenta gratis para comentar y puntuar los artículos del blog.",
  alternates: { canonical: "/cuenta/registro" },
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <AuthLayout
      panel={
        <AuthPanel
          prompt="$ registro --nuevo-lector"
          title="Creá tu cuenta en segundos"
          intro="Es gratis. Con tu cuenta podés comentar, puntuar los artículos y seguir las conversaciones que te interesan."
          checks={[
            "Gratis y sin publicidad",
            "Comentarios y puntuaciones",
            "Te das de baja cuando quieras",
          ]}
        />
      }
    >
      <RegisterForm
        social={
          <Suspense fallback={null}>
            <SocialSection variant="registro" />
          </Suspense>
        }
      />
    </AuthLayout>
  );
}
