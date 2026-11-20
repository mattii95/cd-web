"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AdminNav, type AdminNavBadges } from "./admin-nav";

const FOCUSABLE = "a[href], button:not([disabled])";

export function AdminDrawer({ badges }: { badges?: AdminNavBadges }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const trigger = openRef.current;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab") return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!items?.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="lg:hidden">
      <button
        ref={openRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-cms-line bg-cms-panel text-cms-ink transition-colors hover:border-cms-control"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div hidden={!open} onKeyDown={onKeyDown} className="fixed inset-0 z-50">
        <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-cms-ink/60" />
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Menú del panel"
          className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col gap-6 overflow-y-auto bg-cms-nav px-5 py-5"
        >
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar menú"
            onClick={close}
            className="flex size-11 cursor-pointer items-center justify-center self-end rounded-full border border-cms-nav-line bg-transparent text-cms-nav-text transition-colors hover:text-white"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <AdminNav onNavigate={close} badges={badges} />
        </div>
      </div>
    </div>
  );
}
