"use client";

import { ToastContainer, toast } from "react-toastify";
import type { CommentActionState } from "@/actions/admin/comments";
import type { UserActionState } from "@/actions/admin/users";
import type { FormState } from "@/actions/cuenta";

const GENERIC = "No pudimos completar la acción. Intentá de nuevo en unos minutos.";

// Recibe lo que devuelven las Server Actions y muestra un aviso; "idle" no muestra nada.
export function notify(state: FormState | UserActionState | CommentActionState) {
  if (state.status === "success") toast.success(state.message);
  else if (state.status === "error") toast.error(state.message ?? GENERIC);
}

// Aviso con el botón "Deshacer": dura lo mismo que los demás (6 s) y se cierra al usarlo.
export function notifyWithUndo(message: string, onUndo: () => void) {
  toast.success(({ closeToast }) => (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          closeToast();
          onUndo();
        }}
        className="min-h-11 cursor-pointer rounded-lg bg-white px-4 text-sm font-semibold text-cms-ink transition-colors hover:bg-cms-chip"
      >
        Deshacer
      </button>
    </div>
  ));
}

export function AdminToaster() {
  return <ToastContainer position="bottom-right" autoClose={6000} theme="colored" />;
}
