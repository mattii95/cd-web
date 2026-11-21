import Link from "next/link";
import { UserAvatar } from "@/components/auth/user-avatar";
import type { NewUser } from "@/db/admin-dashboard";
import { avatarSrc } from "@/lib/auth/avatar";
import { formatDate } from "@/lib/format-date";
import { SectionCard, SectionEmpty } from "./section-card";

export function NewestUsers({ items }: { items: NewUser[] }) {
  return (
    <SectionCard title="Últimos registrados" scope="Ahora">
      {items.length === 0 ? (
        <SectionEmpty text="Todavía no hay usuarios." className="h-40" />
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col divide-y divide-cms-line-soft p-0">
            {items.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(u.email)}`}
                  className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 no-underline transition-colors hover:bg-cms-chip"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-full bg-cms-chip text-sm font-bold text-cms-ink"
                  >
                    <UserAvatar name={u.name} image={avatarSrc(u.image)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-cms-ink [overflow-wrap:anywhere]">{u.name}</span>
                    <span className="block text-sm text-cms-text [overflow-wrap:anywhere]">{u.email}</span>
                  </span>
                  <span className="flex-none text-sm text-cms-muted">{formatDate(u.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/users"
            className="inline-flex min-h-11 items-center self-start font-semibold text-cms-link underline-offset-2 hover:underline"
          >
            Ver todos los usuarios
          </Link>
        </>
      )}
    </SectionCard>
  );
}
