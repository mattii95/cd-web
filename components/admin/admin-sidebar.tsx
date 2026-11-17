import Link from "next/link";
import { ExternalLink } from "@/components/icons";
import { AdminNav } from "./admin-nav";

export function AdminLogo() {
  return (
    <Link
      href="/admin"
      className="flex min-h-11 items-center gap-3 px-2 text-white no-underline"
    >
      <svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30" fill="none">
        <path d="M15 2 26 8.5v13L15 28 4 21.5v-13L15 2Z" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M15 9v12" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="font-display text-lg font-semibold">Courroux Digital</span>
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
