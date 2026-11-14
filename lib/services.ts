import type { ServiceIcon } from "@/components/icons";

export type Service = {
  slug:
    | "desarrollo-web"
    | "sistemas-a-medida"
    | "desarrollo-saas"
    | "inteligencia-artificial";
  title: string;
  description: string;
  isNew?: boolean; // badge "Nuevo"
  icon: ServiceIcon; // ícono grande del hero y de "Otros servicios"
  headline: string; // h1 de la página de servicio
  intro: string; // bajada del hero; también es la meta description
  tags: string[];
  features: { title: string; text: string }[]; // 6 ítems de "Qué incluye"
  idealFor: string[]; // 4 casos de "¿Es para vos?"
};

// href = `/servicios/${slug}`
export const services: Service[] = [
  {
    slug: "desarrollo-web",
    title: "Desarrollo web",
    description:
      "Sitios web, landing pages y tiendas online rápidas, que se adaptan a cualquier pantalla y convierten visitas en clientes.",
    icon: "code",
    headline: "Tu negocio, con una web que trabaja por vos",
    intro:
      "Diseñamos y desarrollamos sitios rápidos, adaptados a celulares y listos para aparecer en Google y recibir consultas.",
    tags: ["Landing pages", "Sitios institucionales", "Tiendas online"],
    features: [
      {
        title: "Diseño a medida",
        text: "Una identidad visual propia, nada de plantillas genéricas.",
      },
      {
        title: "Adaptado a celulares",
        text: "Se ve y funciona perfecto en cualquier pantalla.",
      },
      {
        title: "SEO desde el inicio",
        text: "Estructura y velocidad pensadas para posicionar en Google.",
      },
      {
        title: "WhatsApp y formularios",
        text: "Tus visitas te contactan con un solo clic.",
      },
      {
        title: "Autoadministrable",
        text: "Cambiás textos, fotos y productos sin depender de nadie.",
      },
      {
        title: "Dominio, hosting y SSL",
        text: "Te dejamos todo publicado, seguro y funcionando.",
      },
    ],
    idealFor: [
      "Emprendedores que lanzan su marca",
      "Comercios que quieren vender online",
      "Profesionales que necesitan presencia digital",
      "Empresas que quieren renovar su sitio",
    ],
  },
  {
    slug: "sistemas-a-medida",
    title: "Sistemas a medida",
    description:
      "Software hecho para la forma en que trabaja tu empresa: gestión, stock, turnos, facturación y paneles internos.",
    icon: "layers",
    headline: "Software que se adapta a tu empresa, no al revés",
    intro:
      "Reemplazamos planillas y tareas manuales por un sistema hecho a medida, con toda la información de tu negocio en un solo lugar.",
    tags: ["Sistemas de gestión", "Paneles internos", "Integraciones"],
    features: [
      {
        title: "Relevamiento de procesos",
        text: "Entendemos cómo trabajás antes de escribir una línea de código.",
      },
      {
        title: "Gestión integral",
        text: "Clientes, stock, ventas, turnos o lo que tu negocio necesite.",
      },
      {
        title: "Usuarios y permisos",
        text: "Cada persona ve y hace solo lo que le corresponde.",
      },
      {
        title: "Reportes y paneles",
        text: "Los números clave de tu negocio, siempre actualizados.",
      },
      {
        title: "Integraciones",
        text: "Conectamos facturación electrónica, pagos y otras herramientas.",
      },
      {
        title: "Soporte y mantenimiento",
        text: "Acompañamos el sistema a medida que tu empresa crece.",
      },
    ],
    idealFor: [
      "Empresas que dependen de planillas de Excel",
      "Equipos con procesos repetitivos",
      "Negocios con varias sucursales o depósitos",
      "Quienes necesitan conectar sus herramientas",
    ],
  },
  {
    slug: "desarrollo-saas",
    title: "Desarrollo SaaS",
    description:
      "Convertimos tu idea en un producto por suscripción: del MVP al lanzamiento, y te acompañamos mientras suma clientes.",
    icon: "cloud",
    headline: "De una idea a un producto que factura todos los meses",
    intro:
      "Te ayudamos a validar, construir y escalar tu plataforma por suscripción, con un equipo técnico que te acompaña a largo plazo.",
    tags: ["MVP", "Suscripciones y pagos", "Escalabilidad"],
    features: [
      {
        title: "Definición del MVP",
        text: "Priorizamos lo esencial para salir al mercado rápido.",
      },
      {
        title: "Diseño UX/UI",
        text: "Un producto claro y agradable que tus usuarios entienden solos.",
      },
      {
        title: "Cuentas y roles",
        text: "Registro, equipos, permisos y soporte multiempresa.",
      },
      {
        title: "Cobros recurrentes",
        text: "Planes, suscripciones y pagos automáticos integrados.",
      },
      {
        title: "Infraestructura en la nube",
        text: "Una base preparada para crecer sin rehacer todo.",
      },
      {
        title: "Evolución continua",
        text: "Nuevas funciones y mejoras según lo que piden tus clientes.",
      },
    ],
    idealFor: [
      "Emprendedores con una idea de producto",
      "Empresas que quieren vender su sistema a otras",
      "Startups que necesitan un equipo técnico",
      "Productos existentes que necesitan escalar",
    ],
  },
  {
    slug: "inteligencia-artificial",
    title: "Inteligencia artificial",
    description:
      "Chatbots, asistentes y automatizaciones con IA que atienden a tus clientes y le ahorran horas de trabajo a tu equipo.",
    isNew: true,
    icon: "sparkles",
    headline: "Inteligencia artificial que trabaja para tu negocio",
    intro:
      "Sumamos IA a tu atención, tus procesos y tus sistemas para responder más rápido y ahorrar horas de tareas repetitivas.",
    tags: ["Chatbots", "Automatizaciones", "IA en tu web o sistema"],
    features: [
      {
        title: "Chatbots para WhatsApp y web",
        text: "Atención a tus clientes las 24 horas, con respuestas útiles.",
      },
      {
        title: "Asistentes con tu información",
        text: "Entrenados con tus productos, precios y procesos.",
      },
      {
        title: "Automatización de tareas",
        text: "Lo repetitivo pasa a hacerse solo.",
      },
      {
        title: "Análisis de documentos",
        text: "Extracción y clasificación de datos de facturas, formularios y más.",
      },
      {
        title: "IA integrada",
        text: "Sumamos funciones inteligentes a tu web, sistema o SaaS.",
      },
      {
        title: "Acompañamiento",
        text: "Medimos resultados y ajustamos para que mejore con el tiempo.",
      },
    ],
    idealFor: [
      "Negocios con muchas consultas repetidas",
      "Equipos con mucha carga administrativa",
      "Empresas con información dispersa",
      "Quienes ya tienen un sistema y quieren potenciarlo",
    ],
  },
];

// Mismos 4 pasos en los 4 artboards.
export const processSteps: { title: string; text: string }[] = [
  {
    title: "Charla inicial",
    text: "Entendemos tu negocio, tus objetivos y lo que necesitás.",
  },
  {
    title: "Propuesta",
    text: "Alcance, plazos y presupuesto claros, sin sorpresas.",
  },
  {
    title: "Desarrollo",
    text: "Avanzamos por etapas y vas viendo y probando cada avance.",
  },
  {
    title: "Lanzamiento y soporte",
    text: "Publicamos, te capacitamos y seguimos a tu lado.",
  },
];

export const getService = (slug: string) =>
  services.find((s) => s.slug === slug);
