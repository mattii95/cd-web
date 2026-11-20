"use client";

import { type ReactNode, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  resendUserVerificationAction,
  revokeUserSessionsAction,
  unbanUserAction,
} from "@/actions/admin/users";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { notify } from "@/components/admin/toast";
import type { AdminUserRow } from "@/db/admin-users";
import { formatDate } from "@/lib/format-date";
import { BanDialog } from "./ban-dialog";

type Kind = "ban" | "unban" | "revoke" | "delete";
const idle = { status: "idle" } as const;

const item =
  "flex min-h-11 w-full cursor-pointer flex-col justify-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-cms-ink hover:bg-cms-chip aria-disabled:cursor-not-allowed aria-disabled:text-cms-muted aria-disabled:hover:bg-transparent";

const articles = (n: number) => (n === 1 ? "1 artículo" : `${n} artículos`);

// Con `reason` el ítem queda deshabilitado (aria-disabled, sigue en el orden de foco) y muestra el motivo.
function MenuEntry({
  label,
  onClick,
  reason = null,
  className = "",
}: {
  label: ReactNode;
  onClick: () => void;
  reason?: string | null;
  className?: string;
}) {
  const reasonId = useId();
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={reason ? true : undefined}
      aria-describedby={reason ? reasonId : undefined}
      onClick={reason ? undefined : onClick}
      className={`${item} ${className}`}
    >
      {label}
      {reason && (
        <span id={reasonId} className="mt-0.5 text-xs font-normal text-cms-muted">
          {reason}
        </span>
      )}
    </button>
  );
}

export function UserRowMenu({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const choose = (k: Kind) => {
    // El foco vuelve al botón antes de desmontar el menú: el modal lo recuerda y lo restaura al cerrar.
    trigger.current?.focus();
    setMenuOpen(false);
    setKind(k);
  };

  const resend = () => {
    trigger.current?.focus();
    setMenuOpen(false);
    start(async () => {
      const data = new FormData();
      data.set("id", user.id);
      notify(await resendUserVerificationAction(idle, data));
    });
  };

  const close = () => setKind(null);
  const cancel = () => {
    close();
    trigger.current?.focus();
  };

  // Confirmar corre la action; el resultado sale en el aviso y el diálogo se cierra.
  const confirm = (action: typeof unbanUserAction) =>
    start(async () => {
      const data = new FormData();
      data.set("id", user.id);
      notify(await action(idle, data));
      close();
    });

  const banned = user.status === "bloqueado";
  const isAdmin = user.role === "admin";

  return (
    <div ref={root} className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        aria-label={`Más acciones: ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-busy={pending || undefined}
        onClick={() => setMenuOpen((o) => !o)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-cms-line bg-cms-chip text-cms-ink transition-colors hover:border-cms-link"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-cms-line bg-cms-panel p-1 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
        >
          {banned ? (
            <MenuEntry label="Desbloquear" onClick={() => choose("unban")} />
          ) : (
            <MenuEntry
              label="Bloquear"
              onClick={() => choose("ban")}
              reason={isAdmin ? "Los administradores no se pueden bloquear." : null}
            />
          )}
          <MenuEntry
            label="Cerrar sesiones"
            onClick={() => choose("revoke")}
            reason={
              isSelf
                ? "Para cerrar tu sesión usá «Cerrar sesión»."
                : user.sessions === 0
                  ? "No tiene sesiones abiertas."
                  : null
            }
          />
          {user.status === "sin-verificar" && (
            <MenuEntry label="Reenviar verificación" onClick={resend} />
          )}
          <MenuEntry
            label="Borrar cuenta"
            onClick={() => choose("delete")}
            className="text-red-800 aria-disabled:text-cms-muted"
            reason={
              isAdmin
                ? "Los administradores no se pueden borrar."
                : user.posts > 0
                  ? `Es autor de ${articles(user.posts)}: no se puede borrar.`
                  : null
            }
          />
        </div>
      )}
      {kind === "ban" && <BanDialog user={user} onClose={cancel} />}
      <ConfirmDialog
        open={kind === "unban"}
        title={`¿Desbloquear a ${user.name}?`}
        description={`Bloqueado el ${user.bannedAt ? formatDate(user.bannedAt) : "—"} por ${
          user.bannedByName ?? "un administrador"
        }. Motivo: «${user.banReason ?? ""}». Va a poder volver a iniciar sesión.`}
        confirmLabel="Desbloquear"
        pendingLabel="Desbloqueando…"
        pending={pending}
        onConfirm={() => confirm(unbanUserAction)}
        onCancel={cancel}
      />
      <ConfirmDialog
        open={kind === "revoke"}
        title={`¿Cerrar las sesiones de ${user.name}?`}
        description={`Se ${user.sessions === 1 ? "cierra su sesión abierta" : `cierran sus ${user.sessions} sesiones abiertas`}. Puede volver a iniciar sesión.`}
        confirmLabel="Cerrar sesiones"
        pendingLabel="Cerrando…"
        pending={pending}
        onConfirm={() => confirm(revokeUserSessionsAction)}
        onCancel={cancel}
      />
    </div>
  );
}
