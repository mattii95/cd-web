"use client";

import { useState, useSyncExternalStore, type ComponentType } from "react";
import {
  Check,
  Facebook,
  LinkedIn,
  LinkIcon,
  Mail,
  Share,
  Telegram,
  WhatsApp,
  XLogo,
} from "@/components/icons";

type Network = {
  name: string;
  href: string;
  Icon: ComponentType<{ size?: number }>;
};

// URLs de compartir de cada red. `url` es la URL absoluta y canónica del artículo.
export function shareLinks(title: string, url: string): Network[] {
  const t = encodeURIComponent(title);
  const u = encodeURIComponent(url);
  return [
    { name: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, Icon: WhatsApp },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      Icon: LinkedIn,
    },
    { name: "X", href: `https://x.com/intent/post?text=${t}&url=${u}`, Icon: XLogo },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Icon: Facebook,
    },
    {
      name: "Telegram",
      href: `https://t.me/share/url?url=${u}&text=${t}`,
      Icon: Telegram,
    },
    { name: "email", href: `mailto:?subject=${t}&body=${u}`, Icon: Mail },
  ];
}

const noopSubscribe = () => () => {};

const iconButton =
  "fx-card inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-paper-border bg-white text-[#2b3449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  // navigator.share solo existe en el cliente: en el servidor e hidratando vale false.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  function nativeShare() {
    // Cancelar el panel del sistema rechaza la promesa: no es un error.
    navigator.share({ title, url }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold text-text-faint">
        Compartir
      </span>
      <div className="flex flex-wrap gap-2">
        {shareLinks(title, url).map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            aria-label={`Compartir por ${name}`}
            title={name === "email" ? "Email" : name}
            className={iconButton}
          >
            <Icon size={18} />
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar link"
          title="Copiar link"
          className={iconButton}
        >
          {status === "copied" ? <Check size={18} /> : <LinkIcon size={18} />}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={nativeShare}
            aria-label="Más opciones para compartir"
            title="Más opciones"
            className={iconButton}
          >
            <Share size={18} />
          </button>
        )}
      </div>
      <span role="status" className="min-h-5 text-[13px] text-accent">
        {status === "copied" && "Link copiado"}
        {status === "error" && "No se pudo copiar"}
      </span>
    </div>
  );
}
