import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "@/components/icons";
import { site } from "@/lib/site";
import { AdminNav } from "./admin-nav";

// El texto toma su color de className: blanco en la barra, tinta en la superior.
export function AdminLogo({ className = "text-white" }: { className?: string }) {
  return (
    <Link
      href="/admin"
      className={`flex min-h-11 items-center gap-3 px-2 no-underline ${className}`}
    >
      {/* El logo del sitio tiene la "D" blanca: sobre el fondo claro de la barra superior va en una ficha oscura */}
      <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-cms-nav">
        <Image src="/cd-sin-fondo.png" alt="" width={32} height={32} className="block size-8" />
      </span>
      <span className="font-display text-lg font-bold">{site.name}</span>
    </Link>
  );
}

export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[264px] flex-col gap-8 overflow-y-auto bg-cms-nav px-5 py-7 lg:flex">
      <AdminLogo />
      <AdminNav />
      <Link
        href="/blog"
        className="mt-auto flex min-h-11 items-center gap-2.5 rounded-[10px] border border-cms-nav-line px-3 font-medium text-cms-nav-text no-underline transition-colors hover:text-white"
      >
        <ExternalLink className="size-[18px]" />
        Ver el blog
      </Link>
    </aside>
  );
}
