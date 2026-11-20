import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Article, Chat, Photos, Users } from "@/components/icons";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Inicio" };

const shortcuts = [
  { href: "/admin/articles", title: "Artículos", text: "Creá, editá y publicá las notas del blog.", icon: Article },
  { href: "/admin/media", title: "Medios", text: "Subí y organizá las imágenes del blog.", icon: Photos },
  { href: "/admin/comments", title: "Comentarios", text: "Aprobá u ocultá lo que comentan los lectores.", icon: Chat },
  { href: "/admin/users", title: "Usuarios", text: "Mirá quién se registró y con qué rol.", icon: Users },
] as const;

async function Greeting() {
  const { name } = await requireAdmin();
  return (
    <p className="m-0 font-display text-2xl font-semibold text-cms-ink">
      Hola, {name.split(" ")[0]}
    </p>
  );
}

export default function AdminHomePage() {
  return (
    <>
      <AdminPageHeader
        title="Inicio"
        description="Gestioná el contenido y los usuarios del sitio."
      />
      <Suspense fallback={<div className="h-8" />}>
        <Greeting />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map(({ href, title, text, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-cms-line bg-cms-panel p-6 no-underline shadow-[0_8px_24px_rgba(11,16,32,0.08)] transition-colors hover:border-accent"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-cms-chip text-accent">
              <Icon className="size-[22px]" />
            </span>
            <span className="font-display text-xl font-semibold text-cms-ink">{title}</span>
            <span className="text-[15px] text-cms-text">{text}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
