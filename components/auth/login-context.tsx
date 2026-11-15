"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormMessage } from "./form-message";

function Context() {
  const params = useSearchParams();
  return (
    <>
      <input type="hidden" name="volver" value={params.get("volver") ?? ""} />
      {/* Cancelar y fallar se ven igual: cualquier ?error= de un proveedor da el mismo mensaje. */}
      {params.has("error") && (
        <FormMessage
          state={{
            status: "error",
            message: "No pudimos iniciar sesión con ese proveedor. Probá de nuevo o usá tu email.",
          }}
        />
      )}
      {params.get("estado") === "contrasena-actualizada" && (
        <FormMessage
          state={{
            status: "success",
            message: "Tu contraseña se actualizó. Ya podés iniciar sesión.",
          }}
        />
      )}
    </>
  );
}

// useSearchParams exige <Suspense> con cacheComponents para que la página se prerenderice.
export function LoginContext() {
  return (
    <Suspense fallback={null}>
      <Context />
    </Suspense>
  );
}
