import { cache } from "react";
import { countPendingComments } from "@/db/admin-comments";
import { getCurrentUser } from "@/lib/auth/dal";

// El layout la pone en la barra lateral y en el cajón: una sola consulta por request.
const pendingCount = cache(countPendingComments);

// Servidor. Lee la sesión antes de la base: a quien no es admin no le cuenta ni le muestra nada.
export async function PendingCommentsBadge() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return null;
  const n = await pendingCount();
  if (n === 0) return null;
  return (
    <span
      role="img"
      aria-label={`${n} pendientes`}
      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-cms-ink"
    >
      <span aria-hidden="true">{n > 99 ? "99+" : n}</span>
    </span>
  );
}
