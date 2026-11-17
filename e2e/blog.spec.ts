import { expect, test } from "./fixtures";
import { E2E_AUTHOR } from "./global-setup";
import { sql } from "./helpers";

const SLUG = "senales-sistema-a-medida";
// Las lecturas se cachean en el servidor: cada test que escribe en la base usa slugs
// y combinaciones de filtros que ningún otro test pidió antes.
const PREFIX = "e2e-blog-";

const articulos = (page: import("@playwright/test").Page) =>
  page.getByRole("main").locator('a[href^="/blog/"]');

async function insertarPost(opts: {
  slug: string;
  day: number; // día de nov 2026
  categoria: string;
  estado?: "publicado" | "borrador";
}) {
  const estado = opts.estado ?? "publicado";
  const [{ id }] = await sql<{ id: string }>(
    `insert into post (id, slug, title, excerpt, body, cta, reading_minutes, category_id, author_id, status, published_at)
     select gen_random_uuid()::text, $1, $1, 'extracto', '[{"type":"p","text":"texto"}]'::jsonb, 'cta', 3,
            (select id from category where slug = $2), (select id from "user" where email = $3),
            $4::post_status, case when $4 = 'publicado' then make_timestamp(2026, 11, $5, 12, 0, 0) end
     returning id`,
    [opts.slug, opts.categoria, E2E_AUTHOR, estado, opts.day],
  );
  return id;
}

// El footer enlaza a /privacidad y /terminos, que todavía no existen: su prefetch da 404
// y la consola lo informa. Se descuentan igual que en medios.spec.
let esperadas404: number;

test.beforeEach(({ page }) => {
  esperadas404 = 0;
  page.on("response", (r) => {
    if (r.status() === 404 && /\/(privacidad|terminos)\?/.test(r.url()))
      esperadas404++;
  });
});

test.afterEach(async ({ consoleErrors }) => {
  await sql("delete from post where slug like $1", [`${PREFIX}%`]);
  if (esperadas404) {
    for (let i = consoleErrors.length - 1; i >= 0; i--) {
      if (/status of 404/.test(consoleErrors[i])) consoleErrors.splice(i, 1);
    }
  }
});

test("/blog destaca el post publicado más reciente de la base", async ({
  page,
}) => {
  await page.goto("/blog");
  const destacado = page
    .getByRole("main")
    .locator("a", { hasText: "Destacado" });
  await expect(destacado).toHaveAttribute("href", `/blog/${SLUG}`);
});

test("/blog?categoria=ia muestra solo IA y destaca el más reciente de IA", async ({
  page,
}) => {
  await page.goto("/blog?categoria=ia");
  await expect(articulos(page)).toHaveCount(2);
  const destacado = page
    .getByRole("main")
    .locator("a", { hasText: "Destacado" });
  await expect(destacado).toHaveAttribute(
    "href",
    "/blog/chatbots-ia-atencion-al-cliente",
  );
});

test("Cargar más suma las tarjetas que faltan y el botón desaparece", async ({
  page,
}) => {
  // saas + mvp tiene 2 posts del seed: con 12 más son 14 (1 destacado + 11 en la primera página).
  for (let i = 1; i <= 12; i++) {
    const id = await insertarPost({
      slug: `${PREFIX}p${i}`,
      day: 15,
      categoria: "saas",
    });
    await sql(
      `insert into post_tag (post_id, tag_id) select $1, id from tag where slug = 'mvp'`,
      [id],
    );
  }
  await page.goto("/blog?categoria=saas&etiqueta=mvp");
  await expect(articulos(page)).toHaveCount(12);
  const cargarMas = page.getByRole("button", { name: "Cargar más" });
  await expect(cargarMas).toBeVisible();

  await cargarMas.click();
  await expect(articulos(page)).toHaveCount(14);
  await expect(cargarMas).toHaveCount(0);
});

test("el artículo se arma con datos de la base", async ({ page }) => {
  await page.goto(`/blog/${SLUG}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toContainText(
    "5 señales",
  );
  // Portada y la imagen del cuerpo.
  await expect(
    main.getByRole("img", { name: /Planillas sueltas/ }),
  ).toBeVisible();
  await expect(
    main.getByRole("img", { name: /Cinco señales sobre una línea/ }),
  ).toBeVisible();
  // Autor, con cargo y bio de author_profile.
  await expect(
    main.getByText("Fundador de Courroux Digital").first(),
  ).toBeVisible();
  await expect(
    main.getByText(/Desarrollo webs, sistemas a medida/),
  ).toBeVisible();
  // CTA del servicio de la categoría.
  await expect(
    main.locator('a[href="/servicios/sistemas-a-medida"]'),
  ).toBeVisible();
  // Relacionados y valoraciones.
  await expect(
    main.getByRole("heading", { name: "Seguí leyendo" }),
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Valoraciones y comentarios" }),
  ).toBeVisible();
  await expect(main.getByText("Lucía Fernández")).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Ver más comentarios" }),
  ).toHaveCount(0);
});

test("un artículo sin valoraciones ni comentarios muestra los estados vacíos", async ({
  page,
}) => {
  await page.goto("/blog/validar-idea-saas");
  await expect(page.getByText("Todavía no hay valoraciones")).toBeVisible();
  await expect(page.getByText("Todavía no hay comentarios")).toBeVisible();
});

test("con 25 comentarios aprobados muestra 20 y Ver más comentarios suma 5", async ({
  page,
}) => {
  const id = await insertarPost({
    slug: `${PREFIX}comentarios`,
    day: 14,
    categoria: "sistemas",
  });
  await sql(
    `insert into comment (id, post_id, user_id, text, status, created_at)
     select gen_random_uuid()::text, $1, (select id from "user" where email = $2),
            'Comentario ' || lpad(i::text, 2, '0'), 'aprobado',
            make_timestamp(2026, 11, 16, 12, 0, 0) - (i * interval '1 minute')
     from generate_series(1, 25) i`,
    [id, E2E_AUTHOR],
  );
  await page.goto(`/blog/${PREFIX}comentarios`);
  const comentarios = page.getByText(/^Comentario \d\d$/);
  await expect(comentarios).toHaveCount(20);

  await page.getByRole("button", { name: "Ver más comentarios" }).click();
  await expect(comentarios).toHaveCount(25);
  await expect(
    page.getByRole("button", { name: "Ver más comentarios" }),
  ).toHaveCount(0);
});

test("un slug que no existe muestra no encontrado con noindex", async ({
  page,
}) => {
  const res = await page.goto("/blog/no-existe");
  // Con streaming el estado ya salió como 200: Next lo marca con noindex.
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "5 señales" }),
  ).toHaveCount(0);
});

test("un borrador no es accesible ni aparece en el listado", async ({
  page,
}) => {
  await insertarPost({
    slug: `${PREFIX}borrador`,
    day: 15,
    categoria: "ia",
    estado: "borrador",
  });
  await page.goto(`/blog/${PREFIX}borrador`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: `${PREFIX}borrador` }),
  ).toHaveCount(0);

  await page.goto("/blog?categoria=ia&etiqueta=automatizacion");
  await expect(page.locator(`a[href="/blog/${PREFIX}borrador"]`)).toHaveCount(
    0,
  );
});
