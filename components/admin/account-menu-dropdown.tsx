"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/actions/cuenta";
import { UserAvatar } from "@/components/auth/user-avatar";

const itemClass =
  "flex min-h-11 w-full cursor-pointer items-center rounded-xl border-0 bg-transparent px-4 text-left text-sm font-medium text-cms-ink no-underline transition-colors hover:bg-cms-chip";

export function AccountMenuDropdown({
  name,
  image,
}: {
  name: string;
  image: string | null; // ya pasó por avatarSrc: solo hosts permitidos
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Cuenta: ${name}, administrador`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 max-w-[280px] cursor-pointer items-center gap-3 rounded-full border border-cms-line bg-cms-panel py-0 pr-4 pl-1.5 text-left text-cms-ink transition-colors hover:border-cms-control"
      >
        <span
          aria-hidden="true"
          className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-full bg-cms-ink font-display text-sm font-semibold text-white"
        >
          <UserAvatar name={name} image={image} />
        </span>
        <span aria-hidden="true" className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="text-xs text-cms-muted">Administrador</span>
        </span>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={() => setOpen(false)}
        className="absolute top-full right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-cms-line bg-cms-panel p-2 shadow-[0_8px_24px_rgba(11,16,32,0.12)]"
      >
        <Link href="/cuenta/perfil" className={itemClass}>
          Mi perfil
        </Link>
        <Link href="/" className={itemClass}>
          Ver el sitio
        </Link>
        <form action={signOutAction}>
          <button type="submit" className={itemClass}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
