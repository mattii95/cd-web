import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { PendingCommentsBadge } from "@/components/admin/pending-comments-badge";
import { AdminToaster } from "@/components/admin/toast";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/">) {
  // Lee la sesión y la base: va en su propio <Suspense> para que el resto del shell siga estático.
  const badges = {
    "/admin/comments": (
      <Suspense fallback={null}>
        <PendingCommentsBadge />
      </Suspense>
    ),
  };
  return (
    <div className="min-h-screen bg-cms-canvas font-sans text-cms-ink [color-scheme:light]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-cms-panel focus:px-5 focus:py-3 focus:font-semibold focus:text-cms-ink"
      >
        Saltar al contenido
      </a>
      <AdminSidebar badges={badges} />
      <div className="px-6 py-8 lg:pl-[calc(264px+48px)] lg:pr-12 lg:py-10">
        <AdminTopbar badges={badges} />
        <main id="contenido" className="mt-7 flex flex-col gap-7">
          {children}
        </main>
        <AdminToaster />
      </div>
    </div>
  );
}
