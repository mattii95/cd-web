import { signOutAction } from "@/actions/cuenta";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="fx-ghost inline-flex min-h-11 cursor-pointer items-center rounded-full border border-white/[0.22] bg-transparent px-[22px] py-3 text-sm font-semibold text-white"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
