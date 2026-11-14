import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Ingresá con tu cuenta para comentar y puntuar los artículos del blog.",
  alternates: { canonical: "/cuenta/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthLayout
      panel={
        <AuthPanel
          prompt="$ login --lector"
          title="Sumate a la conversación del blog"
          intro="Iniciá sesión para comentar los artículos, dejar tu puntuación y recibir las respuestas del autor."
          checks={[
            "Comentá cada artículo",
            "Puntuá lo que leíste",
            "Enterate cuando te respondan",
          ]}
        />
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
