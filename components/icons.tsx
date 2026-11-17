import type { ReactNode, SVGProps } from "react";

// Íconos SVG inline del artboard Main. Son decorativos (aria-hidden) salvo
// que el llamador pase un `aria-label` / `aria-hidden={false}`.
// Heredan el color con `currentColor`.

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
  strokeWidth?: number;
};

function Icon({
  size = 20,
  strokeWidth = 1.8,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const User = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Icon>
);

// Flechas y acciones
export const ArrowRight = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);
export const ArrowLeft = (p: IconProps) => (
  <Icon size={16} strokeWidth={2} {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Icon>
);
export const Eye = (p: IconProps) => (
  <Icon {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>
);
export const EyeOff = (p: IconProps) => (
  <Icon {...p}><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3 4.2M6.1 6.1A13 13 0 002 12c1 2.5 5 7 10 7a9.7 9.7 0 004.4-1" /></Icon>
);
export const ArrowUpRight = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M7 17L17 7M8 7h9v9" /></Icon>
);
export const ArrowUp = (p: IconProps) => (
  <Icon size={14} strokeWidth={2} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
);
export const Check = (p: IconProps) => (
  <Icon size={16} strokeWidth={2.2} {...p}><path d="M20 6L9 17l-5-5" /></Icon>
);

// Redes y contacto
export const Instagram = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" />
  </Icon>
);
export const WhatsApp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 01-13.5 7.8L3 21l1.2-4.4A9 9 0 1121 12z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2L9 9.5z" />
  </Icon>
);
export const Mail = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Icon>
);
export const LinkedIn = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 10.5V16M8 7.5v.01M12 16v-5.5M12 13a2.5 2.5 0 015 0v3" />
  </Icon>
);
export const XLogo = (p: IconProps) => (
  <Icon {...p}><path d="M4 4l16 16M20 4L4 20" /></Icon>
);
export const Facebook = (p: IconProps) => (
  <Icon {...p}><path d="M15 3h-2.5A3.5 3.5 0 009 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 011-1H15V3z" /></Icon>
);
export const Telegram = (p: IconProps) => (
  <Icon {...p}><path d="M21 4L3 11l6.5 2.5M21 4l-3 16-8.5-6.5M21 4L9.5 13.5V19l3-3" /></Icon>
);

// Compartir
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </Icon>
);
export const Share = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></Icon>
);

// Servicios
export const Code = (p: IconProps) => (
  <Icon size={28} {...p}><path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13.5 6l-3 12" /></Icon>
);
export const Layers = (p: IconProps) => (
  <Icon size={28} {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17.5l9 5 9-5" />
  </Icon>
);
export const Cloud = (p: IconProps) => (
  <Icon size={28} {...p}><path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4 4 0 01-.5 9.5H7z" /></Icon>
);
export const Sparkles = (p: IconProps) => (
  <Icon size={28} {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
  </Icon>
);

// Ícono de cada servicio (hero y "Otros servicios"), según los artboards Servicio-*
export const serviceIcons = {
  code: Code,
  layers: Layers,
  cloud: Cloud,
  sparkles: Sparkles,
};
export type ServiceIcon = keyof typeof serviceIcons;

// Diferenciales de "Nosotros"
export const Bolt = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></Icon>
);
export const Refresh = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <path d="M17 1l4 4-4 4" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <path d="M7 23l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </Icon>
);
export const Chat = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <path d="M21 12a9 9 0 01-13.5 7.8L3 21l1.2-4.4A9 9 0 1121 12z" />
  </Icon>
);
export const Clock = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

// Panel de administración (trazo del canvas "CMS Courroux Digital")
export const Home = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Icon>
);
export const Article = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h7" /></Icon>
);
export const Photos = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /></Icon>
);
export const Users = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0114 0" /><path d="M16 4.5a4 4 0 010 7M18 14.5A7 7 0 0122 21" /></Icon>
);
export const Search = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>
);
export const ExternalLink = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></Icon>
);
export const Copy = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></Icon>
);
export const Pencil = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></Icon>
);
export const Trash = (p: IconProps) => (
  <Icon size={18} strokeWidth={2} {...p}><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></Icon>
);
// Indicador de "en proceso": gira salvo que la persona pida menos movimiento.
export const Spinner = (p: IconProps) => (
  <Icon size={16} strokeWidth={2.4} className="motion-safe:animate-spin" {...p}><path d="M12 3a9 9 0 109 9" /></Icon>
);
