import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clearRateLimit, createVerifiedUser, login, sql } from "./helpers";

// Un solo admin a la vez y los límites de intentos son por IP (igual que articles.spec).
test.describe.configure({ mode: "serial" });

const SEED_TAGS = [
  "Atención al cliente", "Automatización", "Chatbots", "Gestión", "Landing page", "MVP",
  "Pymes", "Rendimiento", "SEO", "Validación", "Ventas",
];
const POST = "e2e-tag-post";
const POST_TITLE = "E2E Artículo de etiquetas";

const rows = (page: Page) => page.getByRole("table", { name: "Listado de etiquetas" }).locator("tbody tr");
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const modal = (page: Page) => page.getByRole("dialog");
const busqueda = (page: Page) => page.getByRole("searchbox", { name: "Buscar etiquetas" });
const filtros = (page: Page) => page.getByRole("group", { name: "Filtrar por etiqueta" });

async function menu(page: Page, name: string, item: string) {
  await page.getByRole("button", { name: `Más acciones: ${name}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}
async function crear(page: Page, name: string) {
  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill(name);
  await page.getByRole("button", { name: "Crear etiqueta" }).click();
}
// Un artículo publicado con esas etiquetas, creado por SQL: lo mira /blog/{slug}.
async function articuloConEtiquetas(slugs: string[]) {
  const [cat] = await sql<{ id: string }>("select id from category order by position limit 1");
  const [autor] = await sql<{ id: string }>("select id from \"user\" where id = 'autor-e2e'");
  await sql(
    `insert into post (id, slug, title, excerpt, body, cta, reading_minutes, category_id, author_id, status, published_at)
     values ($1, $1, $2, 'extracto',
       '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"texto"}]}]}'::jsonb,
       'cta', 3, $3, $4, 'publicado', now())`,
    [POST, POST_TITLE, cat.id, autor.id],
  );
  await sql(
    "insert into post_tag (post_id, tag_id) select $1, id from tag where slug = any($2)",
    [POST, slugs],
  );
}

// Borrar el artículo por SQL deja vieja la caché de /blog (el servidor no se entera): se invalida
// guardando una etiqueta sin cambios por la interfaz, para no ensuciar a los demás specs.
async function borrarArticuloEInvalidar(page: Page) {
  await sql("delete from post where slug = $1", [POST]);
  await page.goto("/admin/tags");
  await menu(page, "SEO", "Editar");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Etiqueta actualizada.")).toBeVisible();
}

const cleanup = async () => {
  await sql("delete from post where slug = $1", [POST]);
  await sql("delete from tag where slug like 'e2e-%'");
  await sql("update tag set name = 'SEO' where slug = 'seo'");
};
test.afterEach(cleanup);

test.beforeEach(async ({ page }) => {
  await clearRateLimit();
  await cleanup();
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
});

test("Etiquetas en la barra lateral lleva a /admin/tags con las del seed en orden alfabético y su conteo", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: "Etiquetas", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/tags$/);
  await expect(page.getByRole("link", { name: "Etiquetas", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(SEED_TAGS.length);
  for (const [i, name] of SEED_TAGS.entries()) await expect(rows(page).nth(i)).toContainText(name);
  await expect(row(page, "Pymes")).toContainText("3 publicados · 3 en total");
  await expect(page.getByText(`Mostrando 1–${SEED_TAGS.length} de ${SEED_TAGS.length}`)).toBeVisible();
});

test("buscar deja solo las que coinciden, queda en la URL y una búsqueda sin resultados muestra el estado vacío", async ({ page }) => {
  await page.goto("/admin/tags");
  await busqueda(page).fill("seo");
  await expect(page).toHaveURL(/\/admin\/tags\?q=seo$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("SEO");

  await busqueda(page).fill("zzzz");
  await expect(page.getByText("No hay etiquetas que coincidan con «zzzz».")).toBeVisible();
  await page.getByRole("link", { name: "Limpiar búsqueda" }).click();
  await expect(rows(page)).toHaveCount(SEED_TAGS.length);
  await expect(busqueda(page)).toHaveValue("");
});

test("Nueva etiqueta crea una con 0 artículos que sale en el autocompletado del editor", async ({ page }) => {
  await page.goto("/admin/tags");
  await crear(page, "E2E Nube");
  await expect(page.getByText("Etiqueta creada.")).toBeVisible();
  await expect(row(page, "E2E Nube")).toContainText("0 publicados · 0 en total");
  await expect(row(page, "E2E Nube")).toContainText("e2e-nube");

  await page.goto("/admin/articles/new");
  const combo = page.getByRole("combobox", { name: "Etiquetas del artículo" });
  await combo.fill("e2e nube"); // el nombre entero: coincide con la existente y no ofrece crear otra
  await expect(page.getByRole("option", { name: "E2E Nube" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Crear/ })).toHaveCount(0);
});

test("un nombre repetido sugiere fusionar y no crea nada", async ({ page }) => {
  await page.goto("/admin/tags");
  await crear(page, "seo");
  await expect(modal(page).getByText("Ya hay una etiqueta con ese nombre. Usá «Fusionar con…» para unirlas.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre" })).toBeFocused();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(rows(page)).toHaveCount(SEED_TAGS.length);
});

test("renombrar seo cambia el nombre en el artículo sin cambiar la URL y guardar el artículo no crea otra", async ({ page }) => {
  await page.goto("/admin/tags");
  await menu(page, "SEO", "Editar");
  await expect(page.getByRole("textbox", { name: "URL" })).toHaveAttribute("readonly", "");
  await expect(modal(page)).toContainText("La URL no cambia porque la etiqueta tiene artículos publicados.");
  await page.getByRole("textbox", { name: "Nombre" }).fill("Posicionamiento");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Etiqueta actualizada.")).toBeVisible();
  await expect(row(page, "Posicionamiento")).toContainText("seo");

  const blog = await page.context().newPage();
  await blog.goto("/blog");
  const enlace = filtros(blog).getByRole("link", { name: /^Posicionamiento/ });
  await expect(enlace).toBeVisible();
  await expect(enlace).toHaveAttribute("href", "/blog?etiqueta=seo");
  await blog.close();

  // Editar y guardar un artículo con esa etiqueta: el editor manda el slug, no crea otra.
  const [{ id }] = await sql<{ id: string }>(
    "select p.id from post p join post_tag pt on pt.post_id = p.id join tag t on t.id = pt.tag_id where t.slug = 'seo' order by p.slug limit 1",
  );
  await page.goto(`/admin/articles/${id}/edit`);
  await expect(page.getByRole("button", { name: "Quitar etiqueta Posicionamiento" })).toBeVisible();
  const antes = (await sql<{ n: number }>("select count(*)::int as n from tag"))[0].n;
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  expect((await sql<{ n: number }>("select count(*)::int as n from tag"))[0].n).toBe(antes);

  // Se deshace por la interfaz para que el blog vuelva a su nombre.
  await page.goto("/admin/tags");
  await menu(page, "Posicionamiento", "Editar");
  await page.getByRole("textbox", { name: "Nombre" }).fill("SEO");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Etiqueta actualizada.")).toBeVisible();
});

test("Fusionar con… pasa los artículos al destino, borra el origen y se nota en /blog", async ({ page }) => {
  await page.goto("/admin/tags");
  await crear(page, "E2E Origen");
  await expect(page.getByText("Etiqueta creada.")).toBeVisible();
  await articuloConEtiquetas(["e2e-origen", "ventas"]);
  await page.reload();
  await expect(row(page, "E2E Origen")).toContainText("1 publicados · 1 en total");

  await menu(page, "E2E Origen", "Fusionar con…");
  await expect(page.getByRole("button", { name: "Fusionar", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "Etiqueta que queda" }).fill("pym");
  await page.getByRole("option", { name: /Pymes/ }).click();
  await expect(modal(page)).toContainText("Los 1 artículos de «E2E Origen» pasan a «Pymes» y «E2E Origen» se borra. No se puede deshacer.");
  await page.getByRole("button", { name: "Fusionar", exact: true }).click();
  await expect(page.getByText("Listo: 1 artículos pasaron a «Pymes».")).toBeVisible();
  await expect(row(page, "E2E Origen")).toHaveCount(0);
  await expect(row(page, "Pymes")).toContainText("4 publicados · 4 en total");

  const blog = await page.context().newPage();
  await blog.goto("/blog");
  await expect(filtros(blog).getByRole("link", { name: /^E2E Origen/ })).toHaveCount(0);
  await blog.goto(`/blog/${POST}`);
  const lista = blog.getByRole("list", { name: "Etiquetas" }).first(); // la del artículo; las tarjetas relacionadas traen otras
  await expect(lista.getByText("Pymes")).toBeVisible();
  await expect(lista.getByText("Ventas")).toBeVisible();
  await expect(lista.getByText("E2E Origen")).toHaveCount(0);
  await blog.close();
  await borrarArticuloEInvalidar(page);
});

test("Borrar pide confirmación con la cantidad de artículos y la etiqueta deja de salir", async ({ page }) => {
  await page.goto("/admin/tags");
  await crear(page, "E2E Borrar");
  await expect(page.getByText("Etiqueta creada.")).toBeVisible();
  await articuloConEtiquetas(["e2e-borrar"]);
  await page.reload();

  await menu(page, "E2E Borrar", "Borrar");
  await expect(modal(page)).toContainText("¿Borrar la etiqueta «E2E Borrar»?");
  await expect(modal(page)).toContainText("Se quita de 1 artículos. No se puede deshacer.");
  await modal(page).getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Etiqueta borrada.")).toBeVisible();
  await expect(row(page, "E2E Borrar")).toHaveCount(0);

  const blog = await page.context().newPage();
  await blog.goto(`/blog/${POST}`);
  await expect(blog.getByRole("heading", { level: 1, name: POST_TITLE })).toBeVisible();
  await expect(blog.getByText("E2E Borrar")).toHaveCount(0);
  await blog.goto("/blog");
  await expect(filtros(blog).getByRole("link", { name: /^E2E Borrar/ })).toHaveCount(0);
  await blog.close();
  await borrarArticuloEInvalidar(page);
});

test("sin sesión /admin/tags redirige al login", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100/admin/tags");
  await expect(page).toHaveURL(/\/cuenta\/login/);
  await ctx.close();
});

test("a 390 px no hay scroll horizontal y los modales ocupan la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/tags");
  await expect(rows(page)).toHaveCount(SEED_TAGS.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const box = await modal(page).boundingBox();
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(388);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(842);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("los controles miden 44 px o más", async ({ page }) => {
  await page.goto("/admin/tags");
  await expect(rows(page)).toHaveCount(SEED_TAGS.length);
  const botones = [
    page.getByRole("button", { name: "Nueva etiqueta" }),
    page.getByRole("button", { name: "Más acciones: SEO" }),
    busqueda(page),
  ];
  for (const b of botones) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await page.getByRole("button", { name: "Más acciones: SEO" }).click();
  for (const name of ["Editar", "Fusionar con…", "Borrar"])
    expect((await page.getByRole("menuitem", { name }).boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  for (const c of [
    page.getByRole("textbox", { name: "Nombre" }),
    page.getByRole("textbox", { name: "URL" }),
    page.getByRole("button", { name: "Cancelar" }),
    page.getByRole("button", { name: "Crear etiqueta" }),
  ])
    expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
});
