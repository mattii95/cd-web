"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";
import { ArrowUpRight } from "@/components/icons";

type NavLink = { href: string; label: string };

export function MobileMenu({
  links,
  cta,
  account,
}: {
  links: NavLink[];
  cta: NavLink;
  account: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-6 top-full mt-1 flex flex-col gap-1 rounded-3xl border border-white/10 bg-surface/95 p-3 shadow-2xl backdrop-blur-xl"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={close}
            className="rounded-2xl px-4 py-3 text-base font-medium text-text no-underline transition-colors hover:bg-white/10 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
        <div onClick={close}>{account}</div>
        <Link
          href={cta.href}
          onClick={close}
          className="fx-btn flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-[22px] py-[13px] text-sm font-semibold text-white no-underline"
        >
          {cta.label}
          <ArrowUpRight />
        </Link>
      </div>
    </div>
  );
}
