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
