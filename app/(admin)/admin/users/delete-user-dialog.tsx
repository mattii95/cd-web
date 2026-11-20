"use client";

import { useState, useTransition } from "react";
import { deleteUserAction } from "@/actions/admin/users";
import { describedBy, Field, FormDialog, fieldInput } from "@/components/admin/form-dialog";
import { notify } from "@/components/admin/toast";
import type { AdminUserRow } from "@/db/admin-users";
import { isDeleteConfirmed } from "@/lib/admin/user-form";

const idle = { status: "idle" } as const;
const CONFIRM_ID = "delete-user-email";

// Solo se monta abierto: cada apertura empieza con la confirmación vacía.
export function DeleteUserDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (!isDeleteConfirmed(typed, user.email)) return;
    const data = new FormData();
    data.set("id", user.id);
    data.set("confirmEmail", typed);
    start(async () => {
      const res = await deleteUserAction(idle, data);
      if (res.status === "error") {
        if (res.fieldErrors?.confirmEmail) {
          setError(res.fieldErrors.confirmEmail);
          document.getElementById(CONFIRM_ID)?.focus();
        } else notify(res);
        return;
      }
      if (res.status !== "success") return;
      notify(res);
      onClose();
    });
  };

  // Solo lo que existe: los que valen 0 no se listan.
  const losses = [
    user.comments > 0 && `${user.comments} ${user.comments === 1 ? "comentario" : "comentarios"}`,
    user.ratings > 0 && `${user.ratings} ${user.ratings === 1 ? "puntuación" : "puntuaciones"}`,
    user.votes > 0 && `${user.votes} ${user.votes === 1 ? "voto" : "votos"} en comentarios`,
  ].filter(Boolean);

  return (
    <FormDialog
      title={`Borrar la cuenta de ${user.name}`}
      submitLabel="Borrar cuenta"
      pendingLabel="Borrando…"
      pending={pending}
      submitDisabled={!isDeleteConfirmed(typed, user.email)}
      tone="danger"
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-cms-text">
        {losses.length > 0 ? (
          <>
            <p className="m-0">Se borra junto con la cuenta:</p>
            <ul className="m-0 list-disc pl-5">
              {losses.map((l) => (
                <li key={String(l)}>{l}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="m-0">No tiene comentarios ni puntuaciones.</p>
        )}
        <p className="m-0">Las imágenes que subió quedan en Medios. No se puede deshacer.</p>
      </div>
      <Field id={CONFIRM_ID} label={`Escribí ${user.email} para confirmar`} error={error}>
        <input
          id={CONFIRM_ID}
          type="text"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(CONFIRM_ID, { error })}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(undefined);
          }}
          className={fieldInput}
        />
      </Field>
    </FormDialog>
  );
}
