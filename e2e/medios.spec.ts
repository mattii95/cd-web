import { expect, test } from "./fixtures";
import {
  clearRateLimit,
  clearSeedMedia,
  createVerifiedUser,
  login,
  seedMedia,
  sql,
} from "./helpers";

// Mismas razones que auth.spec: un solo usuario a la vez y los límites de intentos son por IP.
test.describe.configure({ mode: "serial" });

const IMAGEN = "e2e/fixtures/imagen.png";
const POST = "e2e-medios-post";

// Imágenes que ya cargó el seed del blog (global-setup): no se pueden borrar, están en uso.
let base: number;
let otras404: string[];
let esperadas404: number;

test.beforeEach(async ({ page, context }) => {
  await clearRateLimit();
  // Los tests parten de una biblioteca sin la imagen de prueba (la deduplicación la detectaría).
  await sql("delete from post where slug = $1", [POST]);
  await sql("delete from media where original_name = 'imagen.png'");
  await clearSeedMedia();
  [{ n: base }] = await sql<{ n: number }>("select count(*)::int as n from media");

  otras404 = [];
  esperadas404 = 0;
  page.on("response", (r) => {
    if (r.status() !== 404) return;
    // El footer enlaza a /privacidad y /terminos, que todavía no existen: su prefetch da 404.
    if (/\/(privacidad|terminos)\?/.test(r.url())) esperadas404++;
    else otras404.push(r.url());
  });

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.goto("/admin/medios");
  await page.waitForLoadState("networkidle");
});

test.afterEach(async ({ consoleErrors }) => {
  await clearSeedMedia();
  expect(otras404, "404 inesperados").toEqual([]);
  if (esperadas404) {
    for (let i = consoleErrors.length - 1; i >= 0; i--) {
      if (/status of 404/.test(consoleErrors[i])) consoleErrors.splice(i, 1);
    }
  }
});

const cards = (page: import("@playwright/test").Page) => page.locator("main ul > li");

async function subir(page: import("@playwright/test").Page, alt: string) {
  await page.getByLabel("Imagen", { exact: true }).setInputFiles(IMAGEN);
  await page.getByLabel("Texto alternativo").fill(alt);
  await page.getByRole("button", { name: "Subir imagen" }).click();
}

test("subir una imagen la muestra en la grilla y se sirve como WebP", async ({ page }) => {
  await subir(page, "Círculo blanco sobre fondo azul");
  await expect(page.getByText("Imagen subida.")).toBeVisible();
  await expect(cards(page)).toHaveCount(base + 1);
  await expect(cards(page).first()).toContainText("Círculo blanco sobre fondo azul");
  await expect(cards(page).first()).toContainText("800 × 600 px");

  const src = await cards(page).first().locator("img").getAttribute("src");
  const res = await page.request.get(src!, { headers: { Accept: "image/webp" } });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");
});

test("subir el mismo archivo otra vez avisa y no suma tarjetas", async ({ page }) => {
  await subir(page, "Primera vez");
  await expect(page.getByText("Imagen subida.")).toBeVisible();
  await expect(cards(page)).toHaveCount(base + 1);

  await subir(page, "Segunda vez");
  await expect(page.getByText("Esa imagen ya estaba subida.")).toBeVisible();
  await expect(cards(page)).toHaveCount(base + 1);
});

test("un archivo .txt muestra el mensaje de formato no soportado", async ({ page }) => {
  await page.getByLabel("Imagen", { exact: true }).setInputFiles({
    name: "notas.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no soy una imagen"),
  });
  await page.getByLabel("Texto alternativo").fill("Notas");
  await page.getByRole("button", { name: "Subir imagen" }).click();
  await expect(page.getByText(/Formato no soportado/)).toBeVisible();
  await expect(cards(page)).toHaveCount(base);
});

test("editar el alt persiste al recargar y no acepta uno vacío", async ({ page }) => {
  await subir(page, "Alt original");
  const card = cards(page).first();
  await expect(card).toContainText("Alt original");

  await card.getByRole("button", { name: "Editar alt" }).click();
  await card.getByLabel("Texto alternativo").fill("   ");
  await card.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("El texto alternativo no puede estar vacío.")).toBeVisible();

  await card.getByLabel("Texto alternativo").fill("Alt nuevo");
  await card.getByRole("button", { name: "Guardar" }).click();
  await expect(card).toContainText("Alt nuevo");
  await page.reload();
  await expect(cards(page).first()).toContainText("Alt nuevo");
});

test("una imagen sin usar se borra con Borrar y Sí", async ({ page }) => {
  await subir(page, "Para borrar");
  const card = cards(page).filter({ hasText: "Para borrar" });
  await card.getByRole("button", { name: "Borrar" }).click();
  await expect(card.getByText("¿Borrar?")).toBeVisible();
  await card.getByRole("button", { name: "No" }).click();
  await expect(card.getByRole("button", { name: "Borrar" })).toBeVisible();

  await card.getByRole("button", { name: "Borrar" }).click();
  await card.getByRole("button", { name: "Sí" }).click();
  await expect(cards(page)).toHaveCount(base);
});

test("una imagen en uso muestra dónde y no se puede borrar", async ({ page }) => {
  await subir(page, "Portada de prueba");
  await expect(cards(page)).toHaveCount(base + 1);
  const [{ id }] = await sql<{ id: string }>(
    "select id from media where original_name = 'imagen.png'",
  );
  const [{ id: autor }] = await sql<{ id: string }>('select id from "user" limit 1');
  await sql(
    `insert into category (id, slug, label, filter_label, service_slug, position)
     values ('e2e-medios-cat', 'e2e-medios-cat', 'c', 'c', 'sistemas-a-medida', 99)
     on conflict do nothing`,
  );
  await sql(
    `insert into post (id, slug, title, excerpt, body, cta, reading_minutes, category_id, author_id, cover_media_id)
     values ($1, $1, 'Post de medios', 'e', '[]', 'c', 1, 'e2e-medios-cat', $2, $3)`,
    [POST, autor, id],
  );
  try {
    await page.reload();
    const card = cards(page).filter({ hasText: "Portada de prueba" });
    await expect(card).toContainText("En uso en: Post de medios");
    await expect(card.getByRole("button", { name: "En uso" })).toBeDisabled();
  } finally {
    await sql("delete from post where slug = $1", [POST]);
    await sql("delete from category where id = 'e2e-medios-cat'");
  }
});

test("Copiar id deja el id en el portapapeles y muestra Copiado", async ({ page }) => {
  await subir(page, "Para copiar");
  const card = cards(page).filter({ hasText: "Para copiar" });
  await card.getByRole("button", { name: "Copiar id" }).click();
  await expect(card.getByText("Copiado")).toBeVisible();

  const [{ id }] = await sql<{ id: string }>(
    "select id from media where original_name = 'imagen.png'",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);
});

test("la barra lateral del panel lleva a Medios", async ({ page }) => {
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Navegación del panel" })
    .getByRole("link", { name: "Medios" })
    .click();
  await expect(page).toHaveURL(/\/admin\/medios$/);
  await expect(page.getByRole("heading", { name: "Medios" })).toBeVisible();
});

test.describe("paginación con 30 imágenes", () => {
  test.beforeEach(async ({ page }) => {
    await seedMedia(30);
    await page.reload();
    await expect(cards(page)).toHaveCount(24);
    await expect(page.getByText(`${base + 30} imágenes`, { exact: true })).toBeVisible();
  });

  const cargarMas = async (page: import("@playwright/test").Page) => {
    await page.getByRole("button", { name: "Cargar más" }).click();
    await expect(cards(page)).toHaveCount(base + 30);
    await expect(page.getByRole("button", { name: "Cargar más" })).toHaveCount(0);
  };

  test("Cargar más deja 30 tarjetas y el botón desaparece", async ({ page }) => {
    await cargarMas(page);
    await expect(page.getByText(`${base + 30} imágenes`, { exact: true })).toBeVisible();
  });

  test("borrar una imagen de la segunda tanda la saca y conserva las demás", async ({ page }) => {
    await cargarMas(page);
    const card = cards(page).filter({ hasText: "Semilla 30" });
    await card.getByRole("button", { name: "Borrar" }).click();
    await card.getByRole("button", { name: "Sí" }).click();
    await expect(cards(page)).toHaveCount(base + 29);
    await expect(page.getByText(`${base + 29} imágenes`, { exact: true })).toBeVisible();
    await expect(cards(page).filter({ hasText: "Semilla 30" })).toHaveCount(0);
    await expect(cards(page).filter({ hasText: "Semilla 01" })).toHaveCount(1);
  });

  test("subir una imagen nueva vuelve a la primera página", async ({ page }) => {
    await cargarMas(page);
    await subir(page, "Imagen nueva");
    await expect(page.getByText("Imagen subida.")).toBeVisible();
    await expect(cards(page)).toHaveCount(24);
    await expect(cards(page).first()).toContainText("Imagen nueva");
    await expect(page.getByText(`${base + 31} imágenes`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cargar más" })).toBeVisible();
  });

  test("editar el alt de la segunda tanda lo muestra sin recargar y persiste", async ({ page }) => {
    await cargarMas(page);
    const card = cards(page).nth(29 + base); // "Semilla 30": al editar, el alt pasa a un input y deja de ser texto
    await expect(card).toContainText("Semilla 30");
    await card.getByRole("button", { name: "Editar alt" }).click();
    await card.getByLabel("Texto alternativo").fill("Alt de la segunda tanda");
    await card.getByRole("button", { name: "Guardar" }).click();
    await expect(cards(page).filter({ hasText: "Alt de la segunda tanda" })).toHaveCount(1);
    await expect(cards(page)).toHaveCount(base + 30);

    await page.reload();
    await expect(cards(page)).toHaveCount(24);
    await page.getByRole("button", { name: "Cargar más" }).click();
    await expect(cards(page)).toHaveCount(base + 30);
    await expect(cards(page).filter({ hasText: "Alt de la segunda tanda" })).toHaveCount(1);
  });
});
