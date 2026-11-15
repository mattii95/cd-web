"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/cuenta/actions";

const itemClass =
  "block w-full cursor-pointer rounded-xl border-0 bg-transparent px-4 py-3 text-left text-sm font-medium text-text no-underline transition-colors hover:bg-white/10 hover:text-white";

export function UserMenuDropdown({
  name,
  image,
  isAdmin,
}: {
  name: string;
  image: string | null; // ya pasó por avatarSrc: solo hosts permitidos
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
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
        aria-label={`Menú de ${name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-accent-light/40 bg-accent/20 font-display text-lg font-bold text-accent-pale transition-colors hover:bg-accent/35"
      >
        {image && image !== failedImage ? (
          <Image
            src={image}
            alt=""
            width={32}
            height={32}
            onError={() => setFailedImage(image)}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          name.trim().charAt(0).toUpperCase()
        )}
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={() => setOpen(false)}
        className="absolute top-full right-0 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-white/10 bg-surface/95 p-2 shadow-2xl backdrop-blur-xl"
      >
        <Link href="/cuenta/perfil" className={itemClass}>
          Mi perfil
        </Link>
        {isAdmin && (
          <Link href="/admin" className={itemClass}>
            Administración
          </Link>
        )}
        <form action={signOutAction}>
          <button type="submit" className={itemClass}>
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
