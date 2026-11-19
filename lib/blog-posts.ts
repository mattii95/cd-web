// Tipos compartidos y formateadores del blog. Los datos viven en la base (db/blog.ts).

export const CATEGORY_ICONS = [
  "code",
  "layers",
  "cloud",
  "sparkles",
  "bolt",
  "chat",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export type BlogTag = { slug: string; name: string };

export type BlogImage = {
  src: string; // "/media/<id>" o "/blog/senales-portada.webp" en el mock
  width: number;
  height: number;
  alt: string;
};

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string } // id: "s1", "s2"… → ancla y entrada del índice
  | { type: "tip"; text: string } // recuadro "Consejo"
  | { type: "summary"; text: string } // recuadro "En resumen"
  | { type: "image"; image: BlogImage; caption?: string }; // ya resuelto

export type BlogRating = 1 | 2 | 3 | 4 | 5;

// "4,6": coma decimal fija, sin depender del locale del entorno.
export const formatAverage = (n: number) => n.toFixed(1).replace(".", ",");

// Fecha fija en UTC: no depende de la hora actual, así el prerender no se rompe.
export const formatPostDate = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\./g, "")
    .replace(/ de /g, " ");
