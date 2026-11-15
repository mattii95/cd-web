import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthPanel } from "@/components/auth/auth-panel";
import { VerifyView } from "@/components/auth/verify-view";

export const metadata: Metadata = {
  title: "Verificar email",
  description: "Verificá tu email para activar tu cuenta del blog.",
  alternates: { canonical: "/cuenta/verificar" },
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <AuthLayout
      panel={
        <AuthPanel
          prompt="$ verificar --email"
          title="Un último paso y listo"
          intro="Abrí el link que te mandamos para confirmar que el email es tuyo y activar tu cuenta."
          checks={[
            "Link válido por 24 horas",
            "Revisá también el spam",
            "Podés pedir otro cuando quieras",
          ]}
        />
      }
    >
      <VerifyView />
    </AuthLayout>
  );
}
