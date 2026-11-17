import { avatarSrc } from "@/lib/auth/avatar";
import { getCurrentUser } from "@/lib/auth/dal";
import { AccountMenuDropdown } from "./account-menu-dropdown";

// Sin usuario (base caída) no muestra nada.
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <AccountMenuDropdown name={user.name} image={avatarSrc(user.image)} />;
}
