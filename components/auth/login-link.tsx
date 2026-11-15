import Link from "next/link";
import { User } from "@/components/icons";

export function LoginLink({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/cuenta/login"
      onClick={onClick}
      className={`fx-ghost inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.22] bg-transparent px-[18px] py-3 text-sm font-semibold text-white no-underline ${className}`}
    >
      <User />
      Ingresar
    </Link>
  );
}
