"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { adminNav, isActive, type AdminNavItem } from "./nav-items";

export type AdminNavBadges = Partial<Record<AdminNavItem["href"], ReactNode>>;
type NavProps = { onNavigate?: () => void; badges?: AdminNavBadges };

// usePathname en una ruta dinámica sin params conocidos (ej. /admin/articles/[id]/edit) necesita
// un <Suspense>: mientras tanto se muestran los mismos enlaces, sin marcar la página actual.
export function AdminNav({ onNavigate, badges }: NavProps) {
  return (
    <Suspense fallback={<NavList pathname="" onNavigate={onNavigate} badges={badges} />}>
      <CurrentNav onNavigate={onNavigate} badges={badges} />
    </Suspense>
  );
}

function CurrentNav({ onNavigate, badges }: NavProps) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} badges={badges} />;
}

function NavList({ pathname, onNavigate, badges }: NavProps & { pathname: string }) {
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
              // La insignia va fuera del enlace: el nombre del enlace sigue siendo solo la etiqueta.
              <div key={item.href} className="relative">
                <Link
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
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                  {badges?.[item.href]}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
