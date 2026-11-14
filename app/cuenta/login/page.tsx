import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthPanel } from "@/components/auth/auth-panel";

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
    />
  );
}
