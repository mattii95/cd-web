import type { ComponentType } from "react";
import { Instagram, Mail, WhatsApp } from "@/components/icons";
import { ContactForm } from "@/components/home/contact-form";
import { site } from "@/lib/site";

type Channel = {
  command: string;
  value: string;
  href: string;
  Icon: ComponentType;
  external?: boolean;
};

const channels: Channel[] = [
  {
    command: "$ whatsapp",
    value: site.whatsappDisplay,
    href: `https://wa.me/${site.whatsapp}`,
    Icon: WhatsApp,
    external: true,
  },
  {
    command: "$ email",
    value: site.email,
    href: `mailto:${site.email}`,
    Icon: Mail,
  },
  {
    command: "$ instagram",
    value: `@${site.instagram}`,
    href: `https://instagram.com/${site.instagram}`,
    Icon: Instagram,
    external: true,
  },
];

export function Contact() {
  return (
    <section
      id="contacto"
      className="relative overflow-hidden bg-background px-6 py-28 text-white"
    >
      <div
        aria-hidden="true"
        className="fx-grid absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]"
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb2 -bottom-55 -left-45 size-[520px] bg-accent/35"
      />
      <div
        aria-hidden="true"
        className="fx-ring absolute -bottom-65 -left-30 size-[520px] rounded-full border border-dashed border-accent-light/35"
      >
        <span className="absolute -top-[5px] left-1/2 size-2.5 rounded-full bg-accent-light shadow-[0_0_16px_4px_rgba(77,139,255,0.8)]" />
      </div>

      <div className="relative mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-14">
        <div className="flex flex-col gap-[22px]">
          <span className="font-mono text-[13px] font-medium text-accent-soft">
            {"// contacto"}
          </span>
          <h2 className="m-0 font-display text-[clamp(34px,4.2vw,56px)] leading-[1.02] font-bold tracking-[-0.03em]">
            ¿Arrancamos tu proyecto?
          </h2>
          <p className="m-0 max-w-[460px] text-[17px] leading-[1.6] text-text-muted">
            Contanos qué necesitás: una web, un sistema, tu propio SaaS o sumar
            IA a tu negocio. Te respondemos con una propuesta sin compromiso.
          </p>

          <ul className="m-0 mt-1.5 flex list-none flex-col gap-2.5 p-0">
            {channels.map(({ command, value, href, Icon, external }) => (
              <li key={command}>
                <a
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="fx-card flex min-h-16 items-center gap-3.5 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-white no-underline"
                >
                  <span className="fx-icon flex size-10 flex-none items-center justify-center rounded-[10px] bg-accent/20 text-accent-soft">
                    <Icon />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-[11px] text-text-subtle">
                      {command}
                    </span>
                    <span className="truncate text-[15px] font-medium">{value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="fx-reveal">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
