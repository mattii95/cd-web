import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clearRateLimit, clearSeedMedia, clearUploadedMedia, createVerifiedUser, login, seedMedia, sql } from "./helpers";

// Mismas razones que article-editor.spec: un solo admin a la vez y límites de intentos por IP.
test.describe.configure({ mode: "serial" });

const PREFIX = "e2e-picker";
const PNG = "e2e/fixtures/imagen.png";
const WEBP = "e2e/fixtures/imagen.webp";
const SEED_SLUG = "senales-sistema-a-medida";

const slugOf = (title: string) => title.toLowerCase().replace(/\s+/g, "-");
const body = (page: Page) => page.locator("#campo-body");
const dialog = (page: Page) => page.getByRole("dialog");
const toolbar = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "Formato del texto" }).getByRole("button", { name, exact: true });
const tile = (page: Page, alt: string) => dialog(page).getByRole("button", { name: alt, exact: true });
const imageBar = (page: Page) => page.getByRole("toolbar", { name: "Opciones de la imagen" });

async function newArticle(page: Page, title: string) {
  await page.goto("/admin/articles/new");
  await expect(page.getByLabel("Título del artículo")).toBeVisible();
  await expect(body(page)).toBeVisible();
  await page.getByLabel("Título del artículo").fill(title);
  await page.getByLabel("Categoría").selectOption({ index: 1 });
}

const fillPublishable = async (page: Page) => {
  await page.getByLabel("Resumen que aparece debajo del título").fill("Resumen del artículo de prueba");
  await page.getByLabel("Llamado a la acción").fill("Escribinos para empezar");
};

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publicar" }).click();
  await dialog(page).getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Artículo publicado.")).toBeVisible();
  // El primer guardado reemplaza /new por /edit: se espera a que termine la transición.
  await expect(page).toHaveURL(/\/edit$/);
}

async function saveChanges(page: Page) {
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
}

async function uploadInPicker(page: Page, file: string, alt: string) {
  const d = dialog(page);
  await d.getByRole("tab", { name: "Subir imagen" }).click();
  await d.getByLabel("Imagen", { exact: true }).setInputFiles(file);
  await d.getByLabel("Texto alternativo").fill(alt);
  await d.getByRole("button", { name: "Subir imagen" }).click();
  await expect(d.getByRole("status")).toHaveText("Imagen subida.");
}

// Textos de los párrafos y "FIGURE" por cada figura, en orden de aparición.
const sequence = (root: Page | import("@playwright/test").Locator, selector: string) =>
  root.locator(selector).evaluateAll((els) =>
    els.map((e) => (e.tagName === "FIGURE" ? "FIGURE" : (e.textContent ?? "").trim())),
  );

const cleanup = async () => {
  await sql("delete from post where slug like $1", [`${PREFIX}-%`]);
  await clearSeedMedia();
  await clearUploadedMedia();
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

test("portada y cuerpo subiendo imágenes desde el selector: se ven en el blog y en Medios; quitar la portada vuelve al dibujo", async ({ page }) => {
  const TITLE = "E2E Picker Uno";
  const slug = slugOf(TITLE);
  await newArticle(page, TITLE);
  await fillPublishable(page);
  await body(page).click();
  await page.keyboard.type("Primera línea");

  // Portada: Elegir portada → Subir imagen → vuelve a Biblioteca con la imagen elegida → Usar como portada.
  await page.getByRole("button", { name: "Elegir portada" }).click();
  await expect(dialog(page)).toContainText("Elegir portada");
  await uploadInPicker(page, PNG, "Círculo blanco sobre fondo azul");
  await expect(dialog(page).getByRole("tab", { name: "Biblioteca" })).toHaveAttribute("aria-selected", "true");
  await expect(tile(page, "Círculo blanco sobre fondo azul")).toHaveAttribute("aria-pressed", "true");
  await dialog(page).getByRole("button", { name: "Usar como portada" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText("Círculo blanco sobre fondo azul")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cambiar portada" })).toBeVisible();

  // Cuerpo: Insertar imagen → Subir imagen → Insertar.
  await body(page).click();
  await toolbar(page, "Insertar imagen").click();
  await uploadInPicker(page, WEBP, "Cuadro azul");
  await dialog(page).getByRole("button", { name: "Insertar" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator(".article-editor figure img")).toHaveCount(1);

  await publish(page);
  const [png] = await sql<{ id: string }>("select id from media where original_name = 'imagen.png'");
  const [webp] = await sql<{ id: string }>("select id from media where original_name = 'imagen.webp'");

  // /blog muestra la portada en la tarjeta y /blog/{slug} en el hero.
  const blog = await page.context().newPage();
  await blog.goto("/blog");
  await expect(blog.getByRole("link", { name: new RegExp(TITLE) }).first()).toBeVisible();
  await expect(blog.locator(`img[src*="${png.id}"]`).first()).toBeAttached();
  await blog.goto(`/blog/${slug}`);
  await expect(blog.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(blog.locator(`img[src*="${png.id}"]`).first()).toBeAttached();
  await expect(blog.locator(`figure img[src*="${webp.id}"]`)).toHaveCount(1);

  // Medios: las dos imágenes figuran "En uso en".
  await blog.goto("/admin/media");
  const cards = blog.locator("main ul > li");
  await expect(cards.nth(0)).toContainText(`En uso en: ${TITLE}`);
  await expect(cards.nth(1)).toContainText(`En uso en: ${TITLE}`);

  // Quitar la portada y guardar deja la tarjeta con el dibujo de la categoría.
  await page.getByRole("button", { name: "Quitar portada" }).click();
  await expect(page.getByText("Sin portada")).toBeVisible();
  await saveChanges(page);
  await blog.goto("/blog");
  await expect(blog.getByRole("link", { name: new RegExp(TITLE) }).first()).toBeVisible();
  await expect(blog.locator(`img[src*="${png.id}"]`)).toHaveCount(0);
  const [row] = await sql<{ cover_media_id: string | null }>("select cover_media_id from post where slug = $1", [slug]);
  expect(row.cover_media_id).toBeNull();
  await blog.close();
});

test("insertar con el cursor en el segundo párrafo, pie y alt propio; 'Usar el de Medios' vuelve al de Medios", async ({ page }) => {
  const TITLE = "E2E Picker Dos";
  const slug = slugOf(TITLE);
  await seedMedia(2);
  await newArticle(page, TITLE);
  await fillPublishable(page);
  await body(page).click();
  await page.keyboard.type("uno");
  await page.keyboard.press("Enter");
  await page.keyboard.type("dos");
  await page.keyboard.press("Enter");
  await page.keyboard.type("tres");

  await body(page).locator("p", { hasText: "dos" }).click();
  await toolbar(page, "Insertar imagen").click();
  await expect(dialog(page)).toContainText("Insertar imagen");
  await dialog(page).getByRole("searchbox").fill("Semilla 01");
  await tile(page, "Semilla 01").click();
  await dialog(page).getByRole("button", { name: "Insertar" }).click();
  await expect(dialog(page)).toBeHidden();

  // Queda después de "dos", seleccionada, con su barra.
  expect(await sequence(body(page), "p, figure")).toEqual(["uno", "dos", "FIGURE", "tres"]);
  await expect(imageBar(page)).toBeVisible();
  await expect(body(page).locator("figure img")).toHaveAttribute("alt", "Semilla 01");

  await page.getByRole("button", { name: "Pie de foto" }).click();
  await page.getByRole("group", { name: "Pie de foto" }).getByRole("textbox").fill("Diagrama del flujo");
  await page.getByRole("group", { name: "Pie de foto" }).getByRole("button", { name: "Aplicar" }).click();
  await expect(body(page).locator("figcaption")).toHaveText("Diagrama del flujo");

  await page.getByRole("button", { name: "Texto alternativo" }).click();
  const group = page.getByRole("group", { name: "Texto alternativo" });
  await expect(group).toContainText("Si lo dejás vacío se usa el de Medios: «Semilla 01».");
  // Los controles de la barra y del popover miden 44 px o más.
  for (const c of [...(await imageBar(page).getByRole("button").all()), group.getByRole("button", { name: "Aplicar" }), group.getByRole("textbox")]) {
    expect((await c.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await group.getByRole("textbox").fill("Gráfico propio");
  await group.getByRole("button", { name: "Aplicar" }).click();
  await expect(body(page).locator("figure img")).toHaveAttribute("alt", "Gráfico propio");

  await publish(page);
  const blog = await page.context().newPage();
  await blog.goto(`/blog/${slug}`);
  await expect(blog.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  const figure = blog.locator("figure").filter({ hasText: "Diagrama del flujo" });
  await expect(figure.locator("figcaption")).toHaveText("Diagrama del flujo");
  await expect(figure.locator("img")).toHaveAttribute("alt", "Gráfico propio");
  const order = await sequence(blog, "main p, main figure");
  const i = order.indexOf("dos");
  expect(order.slice(i, i + 3)).toEqual(["dos", "FIGURE", "tres"]);

  // Con "Usar el de Medios", el alt del <img> pasa a ser el de Medios.
  await body(page).locator("figure img").click();
  await page.getByRole("button", { name: "Texto alternativo" }).click();
  await page.getByRole("group", { name: "Texto alternativo" }).getByRole("button", { name: "Usar el de Medios" }).click();
  await saveChanges(page);
  await blog.goto(`/blog/${slug}`);
  await expect(blog.locator("figure").filter({ hasText: "Diagrama del flujo" }).locator("img")).toHaveAttribute("alt", "Semilla 01");
  await blog.close();
});

test("insertar con el cursor dentro de una lista deja la imagen después de la lista", async ({ page }) => {
  await seedMedia(1);
  await newArticle(page, "E2E Picker Tres");
  await body(page).click();
  await page.keyboard.type("Antes");
  await page.keyboard.press("Enter");
  await toolbar(page, "Lista con viñetas").click();
  await page.keyboard.type("item uno");

  await toolbar(page, "Insertar imagen").click();
  await dialog(page).getByRole("searchbox").fill("Semilla 01");
  await tile(page, "Semilla 01").click();
  await dialog(page).getByRole("button", { name: "Insertar" }).click();

  await expect(body(page).locator("figure")).toHaveCount(1);
  await expect(body(page).locator("ul figure")).toHaveCount(0);
  const kinds = await body(page).evaluate((el) => [...el.children].map((c) => c.tagName + (c.querySelector("figure") || c.tagName === "FIGURE" ? ":fig" : "")));
  const ul = kinds.findIndex((k) => k.startsWith("UL"));
  expect(kinds[ul + 1]).toMatch(/:fig$/);
});

test("la búsqueda del selector muestra la imagen que coincide y oculta las demás", async ({ page }) => {
  await seedMedia(3);
  await newArticle(page, "E2E Picker Cuatro");
  await page.getByRole("button", { name: "Elegir portada" }).click();
  await dialog(page).getByRole("searchbox").fill("Semilla");
  await expect(tile(page, "Semilla 01")).toBeVisible();
  await expect(tile(page, "Semilla 02")).toBeVisible();
  await dialog(page).getByRole("searchbox").fill("Semilla 02");
  await expect(tile(page, "Semilla 02")).toBeVisible();
  await expect(tile(page, "Semilla 01")).toHaveCount(0);
  await dialog(page).getByRole("searchbox").fill("no-existe-esto");
  await expect(dialog(page)).toContainText("No hay imágenes que coincidan con «no-existe-esto».");
  // Escape cierra sin elegir nada.
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByText("Sin portada")).toBeVisible();
});

test("si la imagen elegida como portada se borra antes de guardar, el editor avisa y el blog no cambia", async ({ page }) => {
  const TITLE = "E2E Picker Cinco";
  const slug = slugOf(TITLE);
  const [id] = await seedMedia(1);
  await newArticle(page, TITLE);
  await fillPublishable(page);
  await body(page).click();
  await page.keyboard.type("Texto");
  await publish(page);

  await page.getByRole("button", { name: "Elegir portada" }).click();
  await dialog(page).getByRole("searchbox").fill("Semilla 01");
  await tile(page, "Semilla 01").click();
  await dialog(page).getByRole("button", { name: "Usar como portada" }).click();
  await expect(page.getByRole("button", { name: "Quitar portada" })).toBeVisible();

  await sql("delete from media where id = $1", [id]);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Una de las imágenes ya no está en Medios. Elegí otra.")).toBeVisible();

  const [row] = await sql<{ cover_media_id: string | null }>("select cover_media_id from post where slug = $1", [slug]);
  expect(row.cover_media_id).toBeNull();
  const blog = await page.context().newPage();
  await blog.goto(`/blog/${slug}`);
  await expect(blog.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await blog.close();
});

test("soltar o pegar un archivo sobre el cuerpo no inserta nada", async ({ page }) => {
  await newArticle(page, "E2E Picker Seis");
  await body(page).click();
  await page.keyboard.type("Texto");

  const prevented = await body(page).evaluate((el) => {
    const make = () => {
      const dt = new DataTransfer();
      dt.items.add(new File(["x"], "a.png", { type: "image/png" }));
      return dt;
    };
    const r = el.getBoundingClientRect();
    const at = { clientX: r.left + 20, clientY: r.top + 20, bubbles: true, cancelable: true };
    const drop = new DragEvent("drop", { ...at, dataTransfer: make() });
    el.dispatchEvent(drop);
    const paste = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: make() });
    el.dispatchEvent(paste);
    return [drop.defaultPrevented, paste.defaultPrevented];
  });
  expect(prevented).toEqual([true, true]);
  await expect(body(page).locator("figure")).toHaveCount(0);
  await expect(body(page)).toContainText("Texto");
});

test("guardar senales-sistema-a-medida sin tocar nada deja el blog igual (portada e imagen del cuerpo)", async ({ page }) => {
  const [seed] = await sql<{
    id: string;
    body: object;
    cover_media_id: string | null;
    reading_minutes: number;
    updated_at: Date;
  }>("select id, body, cover_media_id, reading_minutes, updated_at from post where slug = $1", [SEED_SLUG]);

  const read = async () => {
    await page.goto(`/blog/${SEED_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // El cuerpo llega con streaming: se espera a que aparezca su primera imagen.
    await expect(page.locator("main figure img").first()).toBeAttached();
    return {
      // Guardar recalcula el tiempo de lectura desde el texto (el seed trae el de los datos mock): no es lo que se compara acá.
      text: (await page.getByRole("main").innerText()).replace(/\d+ min de lectura/, "N min de lectura"),
      imgs: await page.locator("main img").evaluateAll((els) => els.map((e) => [e.getAttribute("src"), e.getAttribute("alt")])),
    };
  };
  const before = await read();
  expect(before.imgs.length).toBeGreaterThan(0);

  try {
    await page.goto(`/admin/articles/${seed.id}/edit`);
    await expect(page.locator(".article-editor figure img").first()).toBeVisible();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    expect(await read()).toEqual(before);
    const [after] = await sql<{ cover_media_id: string | null }>("select cover_media_id from post where id = $1", [seed.id]);
    expect(after.cover_media_id).toBe(seed.cover_media_id);
  } finally {
    await sql("update post set body = $2, cover_media_id = $3, reading_minutes = $4, updated_at = $5 where id = $1", [
      seed.id,
      JSON.stringify(seed.body),
      seed.cover_media_id,
      seed.reading_minutes,
      seed.updated_at,
    ]);
  }
});

test("a 390 px el selector ocupa la pantalla, la grilla tiene 2 columnas y no hay scroll horizontal", async ({ page }) => {
  await seedMedia(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await newArticle(page, "E2E Picker Siete");
  await page.getByRole("button", { name: "Elegir portada" }).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(tile(page, "Semilla 01")).toBeVisible();

  const box = (await d.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(389);
  expect(box.height).toBeGreaterThanOrEqual(843);

  const lefts = await d.locator("ul li button[aria-pressed]").evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))]);
  expect(lefts).toHaveLength(2);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(await d.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);

  // Todos los controles del modal miden 44 px o más.
  const controls = [
    d.getByRole("tab", { name: "Biblioteca" }),
    d.getByRole("tab", { name: "Subir imagen" }),
    d.getByRole("button", { name: "Cerrar" }),
    d.getByRole("button", { name: "Cancelar" }),
    d.getByRole("button", { name: "Usar como portada" }),
    d.getByRole("searchbox"),
  ];
  for (const c of controls) {
    expect((await c.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});

test("en escritorio el modal no pasa de 960 px", async ({ page }) => {
  await newArticle(page, "E2E Picker Ocho");
  await page.getByRole("button", { name: "Elegir portada" }).click();
  const box = (await dialog(page).boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(960);
  expect(box.width).toBeGreaterThan(600);
});
