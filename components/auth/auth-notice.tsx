import Link from "next/link";

// Estado sin formulario: título, texto y un link con el estilo del botón principal.
export function AuthNotice({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text: string;
  href: string;
  label: string;
}) {
  return (
    <div className="fx-reveal relative flex w-full max-w-[440px] flex-col gap-[18px]">
      <div className="mb-1.5 flex flex-col gap-2">
        <h2 className="m-0 font-display text-[34px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="m-0 text-[15px] leading-normal text-text-faint">{text}</p>
      </div>
      <Link
        href={href}
        className="fx-btn mt-1 flex min-h-[52px] items-center justify-center rounded-xl bg-accent text-base font-semibold text-white no-underline"
      >
        {label}
      </Link>
    </div>
  );
}
