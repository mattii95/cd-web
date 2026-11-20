// Cada variante define su propio fondo, texto, borde y hover: no se apilan sobre `btn`, porque dos
// `bg-*` en el mismo elemento los resuelve el orden de la hoja de estilos y no el del className.
const base =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cms-link disabled:cursor-not-allowed disabled:opacity-50";

// Secundario: blanco con borde; al pasar el mouse se tiñe de azul.
export const btn = `${base} border-cms-control bg-cms-panel text-cms-ink hover:border-cms-link hover:bg-cms-chip hover:text-cms-link disabled:hover:border-cms-control disabled:hover:bg-cms-panel disabled:hover:text-cms-ink`;

// Principal: la acción que sigue (subir, guardar, elegir archivos).
export const btnPrimary = `${base} border-accent bg-accent text-white shadow-sm hover:border-accent-hover hover:bg-accent-hover disabled:hover:border-accent disabled:hover:bg-accent`;

// Destructivo suave: borrar, mientras todavía hay que confirmar.
export const btnDanger = `${base} border-red-700 bg-red-50 text-red-700 hover:bg-red-100 disabled:hover:bg-red-50`;

// Destructivo firme: confirma el descarte.
export const btnDangerSolid = `${base} border-red-700 bg-red-700 text-white shadow-sm hover:border-red-800 hover:bg-red-800`;

// Solo ícono (cerrar, quitar, anterior, siguiente): el nombre va en aria-label.
export const iconBtn =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cms-control bg-cms-panel text-cms-ink transition-colors hover:border-cms-link hover:bg-cms-chip hover:text-cms-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cms-link disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-cms-control disabled:hover:bg-cms-panel disabled:hover:text-cms-ink";
