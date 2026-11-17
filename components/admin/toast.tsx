"use client";

import { ToastContainer, toast } from "react-toastify";
import type { FormState } from "@/actions/cuenta";

// Recibe lo que devuelven las Server Actions y muestra un aviso; "idle" no muestra nada.
export function notify(state: FormState) {
  if (state.status === "success") toast.success(state.message);
  else if (state.status === "error") toast.error(state.message);
}

export function AdminToaster() {
  return <ToastContainer position="bottom-right" autoClose={6000} theme="colored" />;
}
