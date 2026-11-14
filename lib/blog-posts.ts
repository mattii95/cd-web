import type { ServiceSlug } from "@/lib/services";

export type BlogCategoryTag = "desarrollo-web" | "sistemas" | "saas" | "ia";

export type BlogCategory = {
  tag: BlogCategoryTag; // se muestra como "// sistemas"
  label: string; // badge de la card
  filterLabel: string; // botón de filtro
  service: ServiceSlug; // servicio del CTA del artículo
};

// En el orden de los filtros.
export const blogCategories: BlogCategory[] = [
  {
    tag: "desarrollo-web",
    label: "Desarrollo web",
    filterLabel: "Desarrollo web",
    service: "desarrollo-web",
  },
  {
    tag: "sistemas",
    label: "Sistemas",
    filterLabel: "Sistemas",
    service: "sistemas-a-medida",
  },
  {
    tag: "saas",
    label: "SaaS",
    filterLabel: "SaaS",
    service: "desarrollo-saas",
  },
  {
    tag: "ia",
    label: "Inteligencia artificial",
    filterLabel: "IA",
    service: "inteligencia-artificial",
  },
];

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string } // id: "s1", "s2"… → ancla y entrada del índice
  | { type: "tip"; text: string } // recuadro "Consejo"
  | { type: "summary"; text: string }; // recuadro "En resumen"

export type BlogRating = 1 | 2 | 3 | 4 | 5;

export type BlogComment = {
  id: string;
  name: string;
  initials: string;
  rating: BlogRating;
  time: string; // texto mock: "Hace 2 días"
  likes: number; // "Útil · 12"
  text: string;
  reply?: { text: string; time: string }; // respuesta del autor
};

export type BlogReviews = {
  distribution: Record<BlogRating, number>; // valoraciones por estrella
  comments: BlogComment[]; // del más reciente al más antiguo
};

export type BlogPost = {
  slug: string;
  category: BlogCategoryTag;
  readingMinutes: number;
  publishedAt: string; // ISO sin hora
  title: string;
  excerpt: string;
  body: BlogBlock[];
  cta: string;
  reviews?: BlogReviews; // mock: solo senales-sistema-a-medida
};

export type BlogAuthor = {
  name: string;
  role: string;
  bio: string;
  initials: string;
};

export const blogAuthor: BlogAuthor = {
  name: "Matías Courroux",
  role: "Fundador de Courroux Digital",
  bio: "Desarrollo webs, sistemas a medida y productos SaaS para negocios que quieren crecer con tecnología.",
  initials: "MC",
};

// Mock corto compartido: se reemplaza cuando llegue el spec del blog dinámico.
const mockBody = (
  a: string,
  b: string,
  tip: string,
  summary: string,
): BlogBlock[] => [
  {
    type: "p",
    text: "Texto de ejemplo: este artículo es un placeholder hasta que el blog sea dinámico.",
  },
  { type: "h2", id: "s1", text: a },
  {
    type: "p",
    text: "Contenido de ejemplo para esta sección. Se reemplaza con el texto real del artículo.",
  },
  { type: "tip", text: tip },
  { type: "h2", id: "s2", text: b },
  {
    type: "p",
    text: "Contenido de ejemplo para esta sección. Se reemplaza con el texto real del artículo.",
  },
  { type: "summary", text: summary },
];

const mockCta = "Contanos tu caso y te decimos por dónde empezar.";

// Ordenados por publishedAt descendente: el primero es el destacado.
export const blogPosts: BlogPost[] = [
  {
    slug: "senales-sistema-a-medida",
    category: "sistemas",
    readingMinutes: 6,
    publishedAt: "2026-11-10",
    title: "5 señales de que tu empresa necesita un sistema a medida",
    excerpt:
      "Si tu equipo vive copiando datos entre planillas, es momento de mirar esto.",
    body: [
      {
        type: "p",
        text: "Muchas empresas arrancan con planillas de Excel y herramientas sueltas, y está perfecto: es la forma más rápida de empezar. El problema aparece cuando el negocio crece y esas herramientas, en lugar de ayudar, empiezan a frenar. Estas son las cinco señales más comunes de que llegó el momento de pensar en un sistema propio.",
      },
      { type: "h2", id: "s1", text: "Tu equipo copia datos de un lado a otro" },
      {
        type: "p",
        text: "Si la misma información se carga en una planilla, después en otra y finalmente en el sistema de facturación, estás pagando horas de trabajo que no suman valor y multiplicando las chances de error.",
      },
      { type: "h2", id: "s2", text: "Nadie sabe cuál es la versión correcta" },
      {
        type: "p",
        text: '"Stock_final_v3_ahora_sí.xlsx" es una señal clara. Cuando varias personas trabajan sobre archivos distintos, la información deja de ser confiable y las decisiones se toman a ciegas.',
      },
      {
        type: "h2",
        id: "s3",
        text: "Los reportes llevan días en lugar de segundos",
      },
      {
        type: "p",
        text: "Si para saber cuánto vendiste el mes pasado alguien tiene que juntar datos de varias fuentes, un sistema puede darte esa respuesta en tiempo real, en un panel siempre actualizado.",
      },
      {
        type: "tip",
        text: "Antes de pensar en el sistema, anotá durante una semana qué tareas se repiten y cuánto tiempo llevan. Esa lista es el mejor punto de partida.",
      },
      {
        type: "h2",
        id: "s4",
        text: "El software genérico te obliga a trabajar a su manera",
      },
      {
        type: "p",
        text: "Las herramientas enlatadas sirven para empezar, pero cuando tu negocio tiene procesos propios terminás adaptándote a ellas, pagando funciones que no usás o haciendo trampas para que funcionen.",
      },
      {
        type: "h2",
        id: "s5",
        text: "Crecer significa sumar más gente para lo mismo",
      },
      {
        type: "p",
        text: "Si cada nuevo cliente implica más trabajo manual, tu crecimiento tiene un techo. Un sistema a medida automatiza lo repetitivo para que tu equipo se enfoque en lo importante.",
      },
      {
        type: "summary",
        text: "Si te identificaste con dos o más de estas señales, probablemente un sistema a medida te ahorre tiempo y dinero en el mediano plazo. No hace falta construir todo de una vez: se puede empezar por el proceso que más duele y crecer desde ahí.",
      },
    ],
    cta: "¿Tu empresa muestra estas señales? Contanos cómo trabajan hoy y te decimos por dónde empezar.",
    // Valoraciones y comentarios mock: se reemplazan con el spec de comentarios.
    reviews: {
      distribution: { 5: 18, 4: 4, 3: 1, 2: 1, 1: 0 },
      comments: [
        {
          id: "c1",
          name: "Lucía Fernández",
          initials: "LF",
          rating: 5,
          time: "Hace 2 días",
          likes: 12,
          text: "Me sentí identificada con la señal 2. Tenemos tres versiones del mismo Excel de stock y nadie sabe cuál es la buena. Muy claro el artículo.",
          reply: {
            text: "¡Gracias, Lucía! Es de lo más común. Un buen primer paso es centralizar ese stock en un solo lugar, aunque sea con una herramienta simple.",
            time: "Hace 1 día",
          },
        },
        {
          id: "c2",
          name: "Martín Gómez",
          initials: "MG",
          rating: 4,
          time: "Hace 4 días",
          likes: 5,
          text: "Buen resumen. Me hubiera gustado ver un ejemplo de cuánto tiempo puede llevar desarrollar un sistema así.",
        },
        {
          id: "c3",
          name: "Carla Ruiz",
          initials: "CR",
          rating: 5,
          time: "Hace 1 semana",
          likes: 8,
          text: "El consejo de anotar las tareas repetidas durante una semana es oro. Lo voy a aplicar con mi equipo.",
        },
        {
          id: "c4",
          name: "Diego Sosa",
          initials: "DS",
          rating: 3,
          time: "Hace 2 semanas",
          likes: 2,
          text: "Interesante, aunque en empresas chicas creo que todavía conviene arrancar con herramientas genéricas.",
          reply: {
            text: "Totalmente de acuerdo, Diego. Para empezar suelen alcanzar; la idea es detectar a tiempo cuándo empiezan a quedar chicas.",
            time: "Hace 2 semanas",
          },
        },
      ],
    },
  },
  {
    slug: "chatbots-ia-atencion-al-cliente",
    category: "ia",
    readingMinutes: 5,
    publishedAt: "2026-11-03",
    title: "Chatbots con IA: qué pueden hacer por tu atención al cliente",
    excerpt:
      "Qué tareas puede resolver un asistente y cuáles conviene dejar en manos de personas.",
    body: mockBody(
      "Qué puede resolver un asistente",
      "Qué conviene dejar a las personas",
      "Empezá por las 10 preguntas que más recibís.",
      "Un chatbot bien acotado descarga a tu equipo de lo repetitivo.",
    ),
    cta: mockCta,
  },
  {
    slug: "landing-page-o-sitio-web-completo",
    category: "desarrollo-web",
    readingMinutes: 4,
    publishedAt: "2026-10-27",
    title: "¿Landing page o sitio web completo? Cuál necesita tu negocio",
    excerpt: "Las diferencias, los costos y cuándo conviene cada opción.",
    body: mockBody(
      "Cuándo alcanza una landing",
      "Cuándo necesitás un sitio completo",
      "Definí primero una sola acción que quieras que haga el visitante.",
      "Una landing valida rápido; el sitio completo acompaña un negocio ya establecido.",
    ),
    cta: mockCta,
  },
  {
    slug: "validar-idea-saas",
    category: "saas",
    readingMinutes: 7,
    publishedAt: "2026-10-20",
    title: "Cómo validar una idea de SaaS antes de programarla",
    excerpt:
      "Pasos simples para comprobar que hay clientes antes de invertir en desarrollo.",
    body: mockBody(
      "Hablá con posibles clientes",
      "Vendé antes de construir",
      "Pedí una preventa o una lista de espera antes de escribir código.",
      "Validar cuesta poco y evita meses de desarrollo en vano.",
    ),
    cta: mockCta,
  },
  {
    slug: "velocidad-web-ventas",
    category: "desarrollo-web",
    readingMinutes: 5,
    publishedAt: "2026-10-13",
    title: "Por qué la velocidad de tu web afecta tus ventas",
    excerpt:
      "Cada segundo de carga cuenta. Te explicamos qué mirar y cómo mejorarlo.",
    body: mockBody(
      "Qué medir",
      "Cómo mejorarlo",
      "Probá tu web desde el celular y con datos móviles.",
      "Una web rápida retiene más visitas y convierte más.",
    ),
    cta: mockCta,
  },
  {
    slug: "automatizaciones-ia-pymes",
    category: "ia",
    readingMinutes: 6,
    publishedAt: "2026-10-06",
    title: "Automatizaciones con IA para pymes: por dónde empezar",
    excerpt: "Tres procesos que casi cualquier negocio puede automatizar hoy.",
    body: mockBody(
      "Procesos candidatos",
      "Cómo empezar sin riesgo",
      "Automatizá primero una tarea chica y medí el ahorro.",
      "Empezar chico permite aprender sin comprometer la operación.",
    ),
    cta: mockCta,
  },
  {
    slug: "excel-o-sistema-de-gestion",
    category: "sistemas",
    readingMinutes: 5,
    publishedAt: "2026-09-29",
    title: "Excel o sistema de gestión: cuándo dar el salto",
    excerpt:
      "Las planillas sirven hasta que dejan de servir. Cómo darte cuenta a tiempo.",
    body: mockBody(
      "Hasta dónde llegan las planillas",
      "Cuándo migrar",
      "Listá qué planillas usa cada área y quién las edita.",
      "Migrá cuando las planillas cuesten más tiempo del que ahorran.",
    ),
    cta: mockCta,
  },
  {
    slug: "mvp-primera-version",
    category: "saas",
    readingMinutes: 6,
    publishedAt: "2026-09-22",
    title: "MVP: qué incluir (y qué no) en la primera versión de tu producto",
    excerpt:
      "Cómo recortar funciones sin perder lo que hace valioso a tu producto.",
    body: mockBody(
      "Qué sí incluir",
      "Qué dejar para después",
      "Si una función no resuelve el problema central, va a la lista de espera.",
      "Un MVP resuelve un problema bien, no todos a medias.",
    ),
    cta: mockCta,
  },
];

export const getPost = (slug: string) => blogPosts.find((p) => p.slug === slug);

export const getCategory = (tag: BlogCategoryTag) =>
  blogCategories.find((c) => c.tag === tag)!;

export function getRatingSummary({ distribution }: BlogReviews) {
  const stars = [1, 2, 3, 4, 5] as const;
  const total = stars.reduce((n, r) => n + distribution[r], 0);
  const sum = stars.reduce((n, r) => n + r * distribution[r], 0);
  return { average: total ? sum / total : 0, total };
}

// "4,6": coma decimal fija, sin depender del locale del entorno.
export const formatAverage = (n: number) => n.toFixed(1).replace(".", ",");

export const getRecentPosts = (n: number) => blogPosts.slice(0, n);

// Misma categoría primero, después los más recientes.
export function getRelatedPosts(post: BlogPost, n: number) {
  const others = blogPosts.filter((p) => p.slug !== post.slug);
  return [
    ...others.filter((p) => p.category === post.category),
    ...others.filter((p) => p.category !== post.category),
  ].slice(0, n);
}

// Fecha fija en UTC: no depende de la hora actual, así el prerender no se rompe.
export const formatPostDate = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(iso))
    .replace(/\./g, "")
    .replace(/ de /g, " ");
