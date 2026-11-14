export type Service = {
  slug:
    | "desarrollo-web"
    | "sistemas-a-medida"
    | "desarrollo-saas"
    | "inteligencia-artificial";
  title: string;
  description: string;
  isNew?: boolean; // badge "Nuevo"
};

// href = `/servicios/${slug}`
export const services: Service[] = [
  {
    slug: "desarrollo-web",
    title: "Desarrollo web",
    description:
      "Sitios web, landing pages y tiendas online rápidas, que se adaptan a cualquier pantalla y convierten visitas en clientes.",
  },
  {
    slug: "sistemas-a-medida",
    title: "Sistemas a medida",
    description:
      "Software hecho para la forma en que trabaja tu empresa: gestión, stock, turnos, facturación y paneles internos.",
  },
  {
    slug: "desarrollo-saas",
    title: "Desarrollo SaaS",
    description:
      "Convertimos tu idea en un producto por suscripción: del MVP al lanzamiento, y te acompañamos mientras suma clientes.",
  },
  {
    slug: "inteligencia-artificial",
    title: "Inteligencia artificial",
    description:
      "Chatbots, asistentes y automatizaciones con IA que atienden a tus clientes y le ahorran horas de trabajo a tu equipo.",
    isNew: true,
  },
];
