import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { MobileMenu } from "@/components/mobile-menu";
import { site } from "@/lib/site";

const navLinks = [
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/blog", label: "Blog" },
  { href: "/#contacto", label: "Contacto" },
];

const cta = { href: "/#contacto", label: "Pedí tu presupuesto" };

// Posicionado en absoluto sobre el contenido: en el diseño el fondo del hero
// (grilla, orbes) continúa detrás del header. Cada página reserva ese espacio
// con su propio padding superior.
export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 text-white">
      <nav
        aria-label="Principal"
        className="relative mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-[22px]"
      >
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <Image
            src="/cd-sin-fondo.png"
            alt=""
            width={48}
            height={48}
            priority
            className="block size-12"
          />
          <span className="font-display text-xl font-bold tracking-[-0.01em]">
            {site.name}
          </span>
        </Link>

        <ul className="m-0 hidden list-none items-center gap-1.5 rounded-full border border-white/10 bg-white/5 p-1.5 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-full px-4 py-2.5 text-sm font-medium text-text no-underline transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href={cta.href}
          className="fx-btn hidden min-h-11 items-center gap-2 rounded-full bg-accent px-[22px] py-[13px] text-sm font-semibold text-white no-underline md:inline-flex"
        >
          {cta.label}
          <ArrowUpRight />
        </Link>

        <MobileMenu links={navLinks} cta={cta} />
      </nav>
    </header>
  );
}
