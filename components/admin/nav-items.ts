import type { ReactNode } from "react";
import { Article, Home, Photos, Users } from "@/components/icons";

export type AdminNavItem = {
  label: string;
  href: "/admin" | "/admin/articulos" | "/admin/medios" | "/admin/usuarios";
  icon: (props: { className?: string }) => ReactNode;
  exact?: boolean; // true solo en Inicio
};
export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };

export const adminNav: AdminNavGroup[] = [
  { label: null, items: [{ label: "Inicio", href: "/admin", icon: Home, exact: true }] },
  {
    label: "Contenido del blog",
    items: [
      { label: "Artículos", href: "/admin/articulos", icon: Article },
      { label: "Medios", href: "/admin/medios", icon: Photos },
    ],
  },
  {
    label: "Administración",
    items: [{ label: "Usuarios", href: "/admin/usuarios", icon: Users }],
  },
];

export function isActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
