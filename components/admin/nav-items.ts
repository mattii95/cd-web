import type { ReactNode } from "react";
import { Article, Chat, Folder, Home, Photos, Tag, Users } from "@/components/icons";

export type AdminNavItem = {
  label: string;
  href:
    | "/admin"
    | "/admin/articles"
    | "/admin/categories"
    | "/admin/tags"
    | "/admin/media"
    | "/admin/comments"
    | "/admin/users";
  icon: (props: { className?: string }) => ReactNode;
  exact?: boolean; // true solo en Inicio
};
export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };

export const adminNav: AdminNavGroup[] = [
  { label: null, items: [{ label: "Inicio", href: "/admin", icon: Home, exact: true }] },
  {
    label: "Contenido del blog",
    items: [
      { label: "Artículos", href: "/admin/articles", icon: Article },
      { label: "Categorías", href: "/admin/categories", icon: Folder },
      { label: "Etiquetas", href: "/admin/tags", icon: Tag },
      { label: "Medios", href: "/admin/media", icon: Photos },
      { label: "Comentarios", href: "/admin/comments", icon: Chat },
    ],
  },
  {
    label: "Administración",
    items: [{ label: "Usuarios", href: "/admin/users", icon: Users }],
  },
];

export function isActive(item: AdminNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
