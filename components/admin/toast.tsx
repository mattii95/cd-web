"use client";

import { ToastContainer, toast } from "react-toastify";
import type { UserActionState } from "@/actions/admin/users";
import type { FormState } from "@/actions/cuenta";

const GENERIC = "No pudimos completar la acción. Intentá de nuevo en unos minutos.";

// Recibe lo que devuelven las Server Actions y muestra un aviso; "idle" no muestra nada.
export function notify(state: FormState | UserActionState) {
  if (state.status === "success") toast.success(state.message);
  else if (state.status === "error") toast.error(state.message ?? GENERIC);
}

export function AdminToaster() {
  return <ToastContainer position="bottom-right" autoClose={6000} theme="colored" />;
}
