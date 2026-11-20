"use client";

import { useState, useTransition } from "react";
import { banUserAction } from "@/actions/admin/users";
import { describedBy, Field, FormDialog, fieldInput } from "@/components/admin/form-dialog";
import { notify } from "@/components/admin/toast";
import type { AdminUserRow } from "@/db/admin-users";
import { parseBanForm, USER_FORM_LIMITS } from "@/lib/admin/user-form";

const idle = { status: "idle" } as const;
const REASON_ID = "ban-reason";

// Solo se monta abierto: cada apertura empieza con el motivo vacío.
export function BanDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  const showError = (message: string) => {
    setError(message);
    document.getElementById(REASON_ID)?.focus();
  };

  const submit = () => {
    const data = new FormData();
    data.set("id", user.id);
    data.set("reason", reason);
    // La misma validación que corre en el servidor.
    const parsed = parseBanForm(data);
    if (!parsed.ok) return showError(parsed.fieldErrors.reason ?? "Revisá el motivo.");
    setError(undefined);
    start(async () => {
      const res = await banUserAction(idle, data);
      if (res.status === "error") {
        if (res.fieldErrors?.reason) showError(res.fieldErrors.reason);
        else notify(res);
        return;
      }
      if (res.status !== "success") return;
      notify(res);
      onClose();
    });
  };

  const sessions =
    user.sessions === 0
      ? ""
      : user.sessions === 1
        ? " y se cierra su sesión abierta"
        : ` y se cierran sus ${user.sessions} sesiones abiertas`;
  const count = reason.trim().length;

  return (
    <FormDialog
      title={`Bloquear a ${user.name}`}
      submitLabel="Bloquear"
      pendingLabel="Bloqueando…"
      pending={pending}
      onSubmit={submit}
      onClose={onClose}
    >
      <p className="m-0 text-[15px] leading-relaxed text-cms-text">
        No va a poder iniciar sesión{sessions}. Sus comentarios siguen publicados.
      </p>
      <Field id={REASON_ID} label="Motivo (solo lo ven los administradores)" error={error}>
        <textarea
          id={REASON_ID}
          value={reason}
          rows={4}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(REASON_ID, { error })}
          onChange={(e) => {
            setReason(e.target.value);
            setError(undefined);
          }}
          className={`${fieldInput} resize-y py-2.5`}
        />
        <p
          className={`m-0 text-right text-sm ${count > USER_FORM_LIMITS.banReason ? "font-semibold text-red-700" : "text-cms-muted"}`}
        >
          {count}/{USER_FORM_LIMITS.banReason}
        </p>
      </Field>
    </FormDialog>
  );
}
