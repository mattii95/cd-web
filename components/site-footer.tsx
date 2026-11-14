import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Instagram,
  Mail,
  WhatsApp,
} from "@/components/icons";
import { services } from "@/lib/services";
import { site } from "@/lib/site";

const company = [
  { href: "/#nosotros", label: "Sobre nosotros" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/blog", label: "Blog" },
  { href: "/#contacto", label: "Contacto" },
];

const socials = [
  {
    label: "Instagram",
    href: `https://instagram.com/${site.instagram}`,
    Icon: Instagram,
  },
  {
    label: "WhatsApp",
    href: `https://wa.me/${site.whatsapp}`,
    Icon: WhatsApp,
  },
];

// Con cacheComponents, `new Date()` en un Server Component rompe el prerender.
// Cacheado, el año se calcula una sola vez y se reutiliza.
async function CurrentYear() {
  "use cache";
  return new Date().getFullYear();
}

const columnTitle = "font-mono text-xs text-accent-soft";
const columnList = "m-0 flex list-none flex-col p-0";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-background text-text-muted">
      <div
        aria-hidden="true"
        className="ft-line absolute inset-x-0 top-0 h-px bg-white/[0.08]"
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb2 -right-40 -bottom-70 size-[520px] bg-accent/30"
      />

      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-14 px-6 pt-20 pb-16">
        <div className="flex flex-wrap gap-12">
          <div className="flex max-w-[380px] flex-[2_1_300px] flex-col gap-5">
            <Link href="/" className="flex items-center gap-3 text-white no-underline">
              <Image
                src="/cd-sin-fondo.png"
                alt=""
                width={48}
                height={48}
                className="block size-12"
              />
              <span className="font-display text-xl font-bold">{site.name}</span>
            </Link>
            <p className="m-0 text-[15px] leading-[1.65]">{site.description}</p>
            <span className="inline-flex items-center gap-2.5 self-start rounded-full border border-accent-light/40 bg-accent/[0.14] px-3.5 py-2 text-[13px] font-semibold text-accent-pale">
              <span className="fx-dot size-2 rounded-full bg-accent-light" />
              Disponibles para nuevos proyectos
            </span>
            <ul aria-label="Redes sociales" className="m-0 flex list-none flex-wrap gap-2.5 p-0">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="ft-soc flex size-11 items-center justify-center rounded-xl border border-white/[0.12] bg-white/5 text-text"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-[1_1_160px] flex-col gap-3.5">
            <span className={columnTitle}>{"// servicios"}</span>
            <ul className={columnList}>
              {services.map((s) => (
                <li key={s.slug}>
                  <Link href={`/servicios/${s.slug}`} className="ft-link min-h-11 items-center text-[15px]">
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-[1_1_160px] flex-col gap-3.5">
            <span className={columnTitle}>{"// empresa"}</span>
            <ul className={columnList}>
              {company.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="ft-link min-h-11 items-center text-[15px]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-[1.4_1_240px] flex-col gap-3.5">
            <span className={columnTitle}>{"// contacto"}</span>
            <ul className="m-0 flex list-none flex-col p-0">
              <li className="flex items-center gap-3 text-[15px] leading-normal">
                <Mail size={18} className="flex-none text-accent-soft" />
                <a href={`mailto:${site.email}`} className="ft-link min-h-11 items-center">
                  {site.email}
                </a>
              </li>
              <li className="flex items-center gap-3 text-[15px] leading-normal">
                <WhatsApp size={18} className="flex-none text-accent-soft" />
                <a
                  href={`https://wa.me/${site.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ft-link min-h-11 items-center"
                >
                  WhatsApp {site.whatsappDisplay}
                </a>
              </li>
            </ul>
            <Link
              href="/#contacto"
              className="fx-btn mt-1.5 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white no-underline"
            >
              Pedí tu presupuesto
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/[0.08] bg-background/85">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-[18px] text-[13px]">
          <span>
            © <CurrentYear /> {site.name}. Todos los derechos reservados.
          </span>
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/terminos" className="ft-link min-h-11 items-center">
              Términos y condiciones
            </Link>
            <Link href="/privacidad" className="ft-link min-h-11 items-center">
              Política de privacidad
            </Link>
          </span>
          <Link
            href="/#inicio"
            className="ft-link min-h-11 items-center gap-2 font-mono text-xs"
          >
            volver_arriba
            <ArrowUp />
          </Link>
        </div>
      </div>
    </footer>
  );
}
