export type BlogPost = {
  slug: string;
  category: string; // "Sistemas"
  categoryTag: string; // "sistemas" → se muestra como "// sistemas"
  readingMinutes: number;
  title: string;
  excerpt: string;
};

// href = `/blog/${slug}`
export const blogPosts: BlogPost[] = [
  {
    slug: "senales-sistema-a-medida",
    category: "Sistemas",
    categoryTag: "sistemas",
    readingMinutes: 6,
    title: "5 señales de que tu empresa necesita un sistema a medida",
    excerpt:
      "Si tu equipo vive copiando datos entre planillas, es momento de mirar esto.",
  },
  {
    slug: "chatbots-ia-atencion-al-cliente",
    category: "Inteligencia artificial",
    categoryTag: "ia",
    readingMinutes: 5,
    title: "Chatbots con IA: qué pueden hacer por tu atención al cliente",
    excerpt:
      "Qué tareas puede resolver un asistente y cuáles conviene dejar en manos de personas.",
  },
  {
    slug: "landing-page-o-sitio-web-completo",
    category: "Desarrollo web",
    categoryTag: "desarrollo-web",
    readingMinutes: 4,
    title: "¿Landing page o sitio web completo? Cuál necesita tu negocio",
    excerpt: "Las diferencias, los costos y cuándo conviene cada opción.",
  },
];
