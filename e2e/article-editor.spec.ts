import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clearRateLimit, createVerifiedUser, login, sql } from "./helpers";

// Mismas razones que articles.spec: un solo admin a la vez y límites de intentos por IP.
test.describe.configure({ mode: "serial" });

const PREFIX = "e2e-editor";
const TITLE = "E2E Editor Uno";
const SLUG = "e2e-editor-uno";
const TAG = "E2E Nube";
const SEED_SLUG = "senales-sistema-a-medida";

const modal = (page: Page) => page.getByRole("dialog");
const body = (page: Page) => page.locator("#campo-body");
const titleField = (page: Page) => page.getByLabel("Título del artículo");
const slugField = (page: Page) => page.getByLabel("Dirección del artículo");
// El enlace de la cabecera del editor (la barra lateral tiene otro "Artículos").
const backLink = (page: Page) =>
  page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) }).getByRole("link", { name: "Artículos" });
const tags = (page: Page) => page.getByRole("combobox", { name: "Etiquetas del artículo" });
const toolbar = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Formato del texto" }).getByRole("button", { name, exact: true });

// Con streaming el blog responde 200 aun si no encuentra el artículo: se mira el contenido.
async function blogShows(page: Page, slug: string, title: string, visible: boolean) {
  const tab = await page.context().newPage();
  await tab.goto(`/blog/${slug}`);
  await expect(tab.getByRole("heading", { level: 1, name: title })).toHaveCount(visible ? 1 : 0);
  await tab.close();
}

async function newArticle(page: Page, title = TITLE) {
  await page.goto("/admin/articles/new");
  await expect(titleField(page)).toBeVisible();
  await expect(body(page)).toBeVisible();
  await titleField(page).fill(title);
  await page.getByLabel("Categoría").selectOption({ index: 1 });
}

const cleanup = async () => {
  await sql("delete from post where slug like $1", [`${PREFIX}-%`]);
  await sql("delete from tag where slug like 'e2e-%'");
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

test("Nuevo artículo en la tabla lleva al editor vacío", async ({ page }) => {
  await page.goto("/admin/articles");
  await page.getByRole("link", { name: "Nuevo artículo" }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo artículo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar borrador" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar artículo" })).toHaveCount(0);
});

test("guardar un borrador deja la URL en /edit y aparece en Borradores", async ({ page }) => {
  await newArticle(page);
  await body(page).click();
  await page.keyboard.type("Primera línea del cuerpo");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("Borrador guardado.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}\/edit$/);

  await page.goto("/admin/articles?status=draft");
  await expect(page.getByRole("row").filter({ hasText: TITLE })).toBeVisible();
});

test("formato, publicar, editar sin cambiar la URL, etiquetas y tiempo de lectura", async ({ page }) => {
  await newArticle(page);
  await page.getByLabel("Resumen que aparece debajo del título").fill("Resumen del artículo de prueba");
  await page.getByLabel("Llamado a la acción").fill("Escribinos para empezar");

  // Cuerpo: H2 con markdown, negrita con atajo, enlace, lista y Consejo con la barra.
  await body(page).click();
  await page.keyboard.type("## Primer título");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Hola ");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("negrita");
  await page.keyboard.press("Control+b");
  await page.keyboard.press("Enter");
  await toolbar(page, "Lista con viñetas").click();
  await page.keyboard.type("item uno");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await toolbar(page, "Consejo").click();
  await page.keyboard.type("mi consejo");
  // El enlace va al final: seleccionar la última palabra y aplicar no deja nada más por escribir.
  await page.keyboard.press("Enter");
  await page.keyboard.type("ver enlace");
  await page.keyboard.press("Control+Shift+ArrowLeft");
  await toolbar(page, "Enlace").click();
  await page.getByLabel("URL").fill("https://ejemplo.com");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(body(page).locator("a")).toHaveText("enlace");

  // Etiqueta nueva.
  await tags(page).fill(TAG);
  await expect(page.getByRole("option", { name: `Crear «${TAG}»` })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: `Quitar etiqueta ${TAG}` })).toBeVisible();

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("Borrador guardado.")).toBeVisible();
  await expect(page).toHaveURL(/\/edit$/);

  // Después de recargar, todo sigue ahí.
  await page.reload();
  await expect(body(page).locator("h2")).toHaveText("Primer título");
  await expect(body(page).locator("strong")).toHaveText("negrita");
  await expect(body(page).locator("ul li")).toHaveText("item uno");
  await expect(body(page).locator('a[href="https://ejemplo.com"]')).toHaveText("enlace");
  await expect(body(page).locator('div[data-type="tip"]')).toHaveText("mi consejo");
  await expect(page.getByRole("button", { name: `Quitar etiqueta ${TAG}` })).toBeVisible();

  // Publicar pide confirmación.
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(modal(page)).toContainText("va a aparecer en el blog");
  await modal(page).getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Artículo publicado.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();

  const blog = await page.context().newPage();
  await blog.goto(`/blog/${SLUG}`);
  await expect(blog.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  const h2 = blog.getByRole("heading", { level: 2, name: /Primer título/ });
  await expect(h2).toContainText("01");
  await expect(blog.locator("strong", { hasText: "negrita" })).toBeVisible();
  await expect(blog.locator("li", { hasText: "item uno" })).toBeVisible();
  await expect(blog.getByText("Consejo", { exact: true })).toBeVisible();
  const link = blog.getByRole("link", { name: "enlace", exact: true });
  await expect(link).toHaveAttribute("href", "https://ejemplo.com");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(blog.getByRole("list", { name: "Etiquetas" }).getByText(TAG)).toBeVisible();
  await blog.goto("/blog");
  await expect(blog.getByRole("group", { name: "Filtrar por etiqueta" }).getByRole("link", { name: new RegExp(`^${TAG}`) })).toBeVisible();

  // Publicado: el slug queda fijo y cambiar el título no cambia la URL.
  await expect(slugField(page)).toHaveAttribute("readonly", "");
  await expect(page.getByText("La URL no cambia porque el artículo ya se publicó.")).toBeVisible();
  await titleField(page).fill("E2E Editor Uno editado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
  await blog.goto(`/blog/${SLUG}`);
  await expect(blog.getByRole("heading", { level: 1, name: "E2E Editor Uno editado" })).toBeVisible();

  // Tiempo de lectura: 450 palabras más pasan a 3 min, en el panel y en el blog.
  await body(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText(Array.from({ length: 450 }, () => "palabra").join(" "));
  await expect(page.getByText("Tiempo de lectura: 3 min, calculado según el texto.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  // El toast anterior sigue en pantalla: se espera al dato, no al aviso.
  await expect
    .poll(async () => (await sql<{ m: number }>("select reading_minutes m from post where slug = $1", [SLUG]))[0].m)
    .toBe(3);
  await blog.goto(`/blog/${SLUG}`);
  await expect(blog.getByText("3 min de lectura").first()).toBeVisible();

  // Pasar a borrador pide confirmación y el blog deja de mostrarlo.
  await page.getByRole("button", { name: "Pasar a borrador" }).click();
  await modal(page).getByRole("button", { name: "Pasar a borrador" }).click();
  await expect(page.getByText("Artículo pasado a borrador.")).toBeVisible();
  await blogShows(page, SLUG, "E2E Editor Uno editado", false);

  // Eliminar pide confirmación, vuelve a la tabla y deja el blog como estaba (invalida la caché).
  await page.getByRole("button", { name: "Eliminar artículo" }).click();
  await expect(modal(page)).toContainText("E2E Editor Uno editado");
  await modal(page).getByRole("button", { name: "Eliminar" }).click();
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByText("Artículo eliminado.")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "E2E Editor Uno editado" })).toHaveCount(0);
  await blog.close();
});

test("editar un artículo con imágenes las muestra y guardar sin tocar no cambia el blog", async ({ page }) => {
  const [seed] = await sql<{ id: string; body: { content: { type: string }[] }; reading_minutes: number; updated_at: Date }>(
    "select id, body, reading_minutes, updated_at from post where slug = $1",
    [SEED_SLUG],
  );
  const images = seed.body.content.filter((n) => n.type === "image").length;
  expect(images).toBeGreaterThan(0);

  const read = async () => {
    await page.goto(`/blog/${SEED_SLUG}`);
    return page.getByRole("main").innerText();
  };
  const before = await read();

  try {
    await page.goto(`/admin/articles/${seed.id}/edit`);
    await expect(page.locator(".article-editor figure img")).toHaveCount(images);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    expect(await read()).toBe(before);
  } finally {
    // Deja la fila como estaba para el resto de los specs.
    await sql("update post set body = $2, reading_minutes = $3, updated_at = $4 where id = $1", [
      seed.id,
      JSON.stringify(seed.body),
      seed.reading_minutes,
      seed.updated_at,
    ]);
  }
});

test("un slug repetido muestra el error debajo del campo", async ({ page }) => {
  await newArticle(page);
  await slugField(page).fill(SEED_SLUG);
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("Ya hay un artículo con esa URL.")).toBeVisible();
  await expect(slugField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/new$/);
});

test("Publicar sin resumen marca el campo y no abre el modal", async ({ page }) => {
  await newArticle(page);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Escribí el resumen.")).toBeVisible();
  await expect(page.getByLabel("Resumen que aparece debajo del título")).toBeFocused();
  await expect(modal(page)).toBeHidden();
});

test("guardar en una pestaña y luego en otra avisa del conflicto y no pisa el cambio", async ({ page }) => {
  await newArticle(page);
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByText("Borrador guardado.")).toBeVisible();
  const url = page.url();
  // Dos pestañas con el mismo artículo, cada una con una carga completa (sin la transición de /new).
  await page.goto(url);
  const other = await page.context().newPage();
  await other.goto(url);
  await expect(titleField(page)).toHaveValue(TITLE);
  await expect(titleField(other)).toHaveValue(TITLE);

  await page.bringToFront();
  await titleField(page).fill("E2E Editor Uno A");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect
    .poll(async () => (await sql<{ title: string }>("select title from post where slug like $1", [`${PREFIX}-%`]))[0].title)
    .toBe("E2E Editor Uno A");

  await other.bringToFront();
  await titleField(other).fill("E2E Editor Uno B");
  await other.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(other.getByText("Alguien modificó este artículo. Recargá para ver los cambios.")).toBeVisible();
  const [row] = await sql<{ title: string }>("select title from post where slug like $1", [`${PREFIX}-%`]);
  expect(row.title).toBe("E2E Editor Uno A");
  await other.close();
});

test("con cambios sin guardar, ← Artículos pregunta antes de salir", async ({ page }) => {
  await newArticle(page);
  await backLink(page).click();
  await expect(modal(page)).toContainText("Los cambios que no guardaste se pierden.");
  await modal(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/\/new$/);
  await backLink(page).click();
  await modal(page).getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/admin\/articles$/);
});

test("Editar desde Más acciones y desde el título abre el editor del artículo correcto", async ({ page }) => {
  const [cat] = await sql<{ id: string }>("select id from category order by position limit 1");
  const [autor] = await sql<{ id: string }>("select id from \"user\" where id = 'autor-e2e'");
  const doc = '{"type":"doc","content":[{"type":"paragraph"}]}';
  for (const n of ["a", "b"]) {
    await sql(
      `insert into post (id, slug, title, excerpt, body, cta, reading_minutes, category_id, author_id, status)
       values (gen_random_uuid()::text, $1, $2, '', $3::jsonb, '', 1, $4, $5, 'borrador')`,
      [`${PREFIX}-${n}`, `E2E Editor ${n}`, doc, cat.id, autor.id],
    );
  }
  await page.goto("/admin/articles?q=E2E+Editor");
  await page.getByRole("button", { name: "Más acciones: E2E Editor b" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await expect(titleField(page)).toHaveValue("E2E Editor b");

  await page.goto("/admin/articles?q=E2E+Editor");
  await page.getByRole("link", { name: "E2E Editor a" }).click();
  await expect(titleField(page)).toHaveValue("E2E Editor a");
});

test("un id inexistente da 404 y sin sesión se redirige al login", async ({ page, browser }) => {
  for (const id of ["no-existe", crypto.randomUUID()]) {
    await page.goto(`/admin/articles/${id}/edit`);
    await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
    await expect(titleField(page)).toHaveCount(0);
  }
  const anon = await browser.newContext({ baseURL: "http://localhost:3100" });
  const anonPage = await anon.newPage();
  await anonPage.goto("/admin/articles/new");
  await expect(anonPage).toHaveURL(/\/cuenta\/login/);
  await anon.close();
});

test("a 390 px no hay scroll horizontal y los botones de la cabecera siguen visibles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newArticle(page);
  await body(page).click();
  await page.keyboard.insertText(Array.from({ length: 600 }, () => "palabra").join(" "));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // A mitad del cuerpo: la cabecera y la barra quedan pegadas arriba.
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(page.getByRole("button", { name: "Guardar borrador" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Publicar" })).toBeInViewport();
  await expect(page.getByRole("toolbar", { name: "Formato del texto" })).toBeInViewport();
});

test("los controles miden 44 px o más", async ({ page }) => {
  await newArticle(page);
  const controls = [
    ...(await page.getByRole("toolbar", { name: "Formato del texto" }).getByRole("button").all()),
    page.getByRole("button", { name: "Guardar borrador" }),
    page.getByRole("button", { name: "Publicar" }),
    titleField(page),
    slugField(page),
    page.getByLabel("Categoría"),
    tags(page),
  ];
  for (const c of controls) {
    const box = await c.boundingBox();
    expect(box?.height, await c.evaluate((e) => e.getAttribute("aria-label") ?? e.id ?? e.textContent)).toBeGreaterThanOrEqual(44);
  }
});
