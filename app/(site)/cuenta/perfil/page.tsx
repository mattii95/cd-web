import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/account/sign-out-button";
import { requireUser } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format-date";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

async function Profile() {
  const user = await requireUser("/cuenta/perfil");
  const rows = [
    ["Nombre", user.name],
    ["Email", user.email],
    ["Rol", user.role === "admin" ? "Administrador" : "Lector"],
    ["Miembro desde", formatDate(user.createdAt)],
  ];

  return (
    <>
      <div className="flex items-center gap-6">
        <span
          aria-hidden="true"
          className="flex size-24 flex-none items-center justify-center rounded-full border border-accent-light/40 bg-accent/20 font-display text-[56px] leading-none font-bold text-accent-pale shadow-[0_0_0_8px_rgba(26,102,245,0.08)]"
        >
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[clamp(30px,4vw,44px)] leading-[1.05] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">
            {user.name}
          </h1>
          <p className="m-0 mt-1.5 text-base text-text-muted [overflow-wrap:anywhere]">
            {user.email}
          </p>
        </div>
      </div>

      <dl className="m-0 mt-12 divide-y divide-border-muted border-y border-border-muted">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
          >
            <dt className="text-sm text-text-subtle">{label}</dt>
            <dd className="m-0 text-base text-text-strong [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <SignOutButton />
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="py-3 text-sm font-semibold text-accent-soft no-underline hover:text-white"
          >
            Ir a administración
          </Link>
        )}
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <main className="bg-background text-white">
      {/* pt: 92px de header (absoluto) + 56px de aire */}
      <div className="mx-auto min-h-[70vh] max-w-[720px] px-6 pt-[148px] pb-24">
        <Suspense fallback={<p className="m-0 text-text-muted">Cargando tu perfil…</p>}>
          <Profile />
        </Suspense>
      </div>
    </main>
  );
}
