export const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-cms-control bg-cms-panel px-4 text-[13px] font-semibold text-cms-ink transition-colors hover:bg-cms-chip disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cms-panel";

// Acciones de la tarjeta: solo ícono (el nombre accesible va en aria-label y title).
const iconBtn =
  "flex size-11 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const iconBtnCopy = `${iconBtn} border-cms-line bg-cms-chip text-cms-link hover:border-cms-link`;
export const iconBtnEdit = `${iconBtn} border-accent bg-accent text-white hover:bg-accent-hover`;
export const iconBtnDelete = `${iconBtn} border-red-300 bg-red-50 text-red-700 hover:border-red-700 disabled:hover:border-red-300`;
