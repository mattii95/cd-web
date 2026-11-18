"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { adminNav, isActive } from "./nav-items";

// usePathname en una ruta dinámica sin params conocidos (ej. /admin/articles/[id]/edit) necesita
// un <Suspense>: mientras tanto se muestran los mismos enlaces, sin marcar la página actual.
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname="" onNavigate={onNavigate} />}>
      <CurrentNav onNavigate={onNavigate} />
    </Suspense>
  );
}

function CurrentNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegación del panel" className="flex flex-col gap-8">
      {adminNav.map((group) => (
        <div key={group.label ?? "inicio"} className="flex flex-col gap-1.5">
          {group.label && (
            <span className="px-3 pb-1.5 text-xs font-semibold text-cms-nav-label">
              {group.label}
            </span>
          )}
          {group.items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 no-underline transition-colors ${
                  active
                    ? "bg-accent font-semibold text-white"
                    : "font-medium text-cms-nav-text hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="size-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
