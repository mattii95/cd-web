import Link from "next/link";
import { signOutAction } from "@/app/cuenta/actions";
import { avatarSrc } from "@/lib/auth/avatar";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginLink } from "./login-link";
import { UserMenuDropdown } from "./user-menu-dropdown";

// Sin sesión (o con la base caída) muestra "Ingresar", igual que el fallback del <Suspense>.
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return <LoginLink />;
  return <UserMenuDropdown name={user.name} image={avatarSrc(user.image)} isAdmin={user.role === "admin"} />;
}

const mobileItem =
  "block w-full cursor-pointer rounded-2xl border-0 bg-transparent px-4 py-3 text-left text-base font-medium text-text no-underline transition-colors hover:bg-white/10 hover:text-white";

// Para el panel del menú mobile. MobileMenu cierra el panel con cualquier click de adentro.
export async function MobileAccount() {
  const user = await getCurrentUser();
  if (!user) return <LoginLink className="mt-2 px-[22px]" />;
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
      <Link href="/cuenta/perfil" className={mobileItem}>
        Mi perfil
      </Link>
      {user.role === "admin" && (
        <Link href="/admin" className={mobileItem}>
          Administración
        </Link>
      )}
      <form action={signOutAction}>
        <button type="submit" className={mobileItem}>
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
