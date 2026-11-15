import { connection } from "next/server";
import { getEnabledProviders } from "@/lib/auth/providers";
import { SocialButtons } from "./social-buttons";

// Lee el entorno en cada request: las variables de proveedor no hacen falta al hacer el build.
export async function SocialSection({ variant }: { variant: "login" | "registro" }) {
  await connection();
  const providers = getEnabledProviders();
  if (providers.length === 0) return null;
  return (
    <SocialButtons providers={providers}>
      {variant === "registro" && (
        <p className="m-0 text-[13px] leading-normal text-text-faint">
          Al continuar con un proveedor aceptás los términos y la política de privacidad.
        </p>
      )}
    </SocialButtons>
  );
}
