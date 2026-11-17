import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MyComments } from "@/components/account/my-comments";
import { SignOutButton } from "@/components/account/sign-out-button";
import { getUserComments } from "@/db/blog-community";
import { getLoginMethods, requireUser, type LoginMethod } from "@/lib/auth/dal";
import { formatDate } from "@/lib/format-date";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

const METHOD_LABEL: Record<LoginMethod, string> = {
  credential: "Email y contraseña",
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
};

async function UserComments() {
  const user = await requireUser("/cuenta/perfil");
  const { items, nextCursor } = await getUserComments(user.id);
  return <MyComments initialItems={items} initialCursor={nextCursor} />;
}

function CommentsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 rounded-xl bg-white/5 motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

async function Profile() {
  const user = await requireUser("/cuenta/perfil");
  const methods = await getLoginMethods(user.id);
  const rows = [
    ["Nombre", user.name],
    ["Email", user.email],
    ["Rol", user.role === "admin" ? "Administrador" : "Lector"],
    ["Métodos de acceso", methods.map((m) => METHOD_LABEL[m]).join(", ")],
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
            className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:items-baseline sm:gap-6"
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

      <section aria-labelledby="mis-comentarios" className="mt-16">
        <h2
          id="mis-comentarios"
          className="m-0 mb-6 font-display text-[28px] font-bold tracking-[-0.02em]"
        >
          Mis comentarios
        </h2>
        <Suspense fallback={<CommentsSkeleton />}>
          <UserComments />
        </Suspense>
      </section>
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
