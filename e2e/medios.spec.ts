import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";
import { expect, test } from "./fixtures";
import {
  APP,
  clearRateLimit,
  clearSeedMedia,
  clearUploadedMedia,
  createVerifiedUser,
  login,
  seedMedia,
  sql,
} from "./helpers";

// Mismas razones que auth.spec: un solo usuario a la vez y los límites de intentos son por IP.
test.describe.configure({ mode: "serial" });

const IMAGEN = "e2e/fixtures/imagen.png";
const SEED_SLUG = "senales-sistema-a-medida";
const SEED_TITLE = "5 señales de que tu empresa necesita un sistema a medida";
const COVER_ALT = "Planillas sueltas que convergen en un único sistema ordenado";
const BODY_ALT = "Cinco señales sobre una línea de tiempo, cada una más intensa que la anterior";
const SEARCH = "Buscar por texto alternativo o nombre de archivo";
const PAGE_SIZE = 24;

// Imágenes que ya cargó el seed del blog (global-setup): están en uso, no se pueden borrar.
let base: number;
let otras404: string[];
let esperadas404: number;

test.beforeEach(async ({ page, context }) => {
  await clearRateLimit();
  // Los tests parten de una biblioteca sin las imágenes de prueba (la deduplicación las detectaría).
  await clearUploadedMedia();
  await clearSeedMedia();
  // Si un test anterior se cortó antes de devolver el alt de la portada del seed, se restaura.
  await sql("update media set alt = $1 where alt = $2", [COVER_ALT, "Alt de prueba para la portada"]);
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
  await page.goto("/admin/media");
  await page.waitForLoadState("networkidle");
});

test.afterEach(async ({ consoleErrors }) => {
  await clearUploadedMedia();
  await clearSeedMedia();
  expect(otras404, "404 inesperados").toEqual([]);
  if (esperadas404) {
    for (let i = consoleErrors.length - 1; i >= 0; i--) {
      if (/status of 404/.test(consoleErrors[i])) consoleErrors.splice(i, 1);
    }
  }
});

const tiles = (page: Page) => page.getByRole("button", { name: /^Ver detalles de / });
const tile = (page: Page, alt: string) =>
  page.getByRole("button", { name: `Ver detalles de ${alt}`, exact: true });
const count = (n: number) => Math.min(n, PAGE_SIZE); // la grilla muestra 24 por tanda
const uploadDialog = (page: Page) => page.getByRole("dialog", { name: "Subir imágenes" });
const detail = (page: Page, alt: string) => page.getByRole("dialog", { name: alt, exact: true });
const total = (page: Page, n: number) => page.getByText(n === 1 ? "1 imagen" : `${n} imágenes`, { exact: true });

type Upload = { name: string; alt: string; buffer?: Buffer };

// Un PNG distinto por color: sha256 distinto, así que no cae en la deduplicación.
const color = (background: string) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background } }).png().toBuffer();

async function pick(page: Page, files: Upload[]) {
  const d = uploadDialog(page);
  await d.getByLabel("Elegir archivos").setInputFiles(
    files.map((f) => ({ name: f.name, mimeType: "image/png", buffer: f.buffer ?? Buffer.from("x") })),
  );
}

async function fillAlts(page: Page, files: Upload[]) {
  for (const f of files) await uploadDialog(page).getByLabel(`Texto alternativo de ${f.name}`).fill(f.alt);
}

// Abre el modal, sube los archivos y espera el resumen. No lo cierra.
async function subir(page: Page, files: Upload[]) {
  await page.getByRole("button", { name: "Subir imágenes" }).first().click();
  await pick(page, files);
  await fillAlts(page, files);
  await uploadDialog(page)
    .getByRole("button", { name: files.length === 1 ? "Subir 1 imagen" : `Subir ${files.length} imágenes` })
    .click();
}

async function subirYCerrar(page: Page, files: Upload[]) {
  await subir(page, files);
  await uploadDialog(page).getByRole("button", { name: "Listo" }).click();
  await expect(uploadDialog(page)).toBeHidden();
}

const fixture = async (): Promise<Upload> => ({
  name: "e2e-medios-imagen.png",
  alt: "Círculo blanco sobre fondo azul",
  buffer: await sharp(IMAGEN).png().toBuffer(),
});

async function buscar(page: Page, texto: string) {
  await page.getByLabel(SEARCH).fill(texto);
  await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(texto).replace(/%20/g, "(%20|\\+)")}`));
}

async function filtrar(page: Page, opcion: "Todas" | "En uso" | "Sin usar") {
  await page.getByRole("radiogroup", { name: "Filtrar por uso" }).getByText(opcion, { exact: true }).click();
}

// Edita el alt desde el detalle de una imagen que se encuentra buscándola; devuelve el aviso de guardado.
async function cambiarAlt(page: Page, actual: string, nuevo: string) {
  await buscar(page, actual.slice(0, 20));
  await tile(page, actual).click();
  const d = detail(page, actual);
  await d.getByRole("button", { name: "Editar" }).click();
  await d.getByLabel("Texto alternativo").fill(nuevo);
  await d.getByRole("button", { name: "Guardar cambios" }).click();
  const guardado = detail(page, nuevo); // el título pasó a ser el alt nuevo
  await expect(guardado.getByRole("button", { name: "Editar" })).toBeVisible();
  await guardado.getByRole("button", { name: "Cerrar" }).click();
}

test("subir 3 imágenes con sus alts las muestra primero en la grilla y se sirven como WebP", async ({ page }) => {
  const files: Upload[] = [
    { name: "e2e-medios-a.png", alt: "Rojo", buffer: await color("#c0392b") },
    { name: "e2e-medios-b.png", alt: "Verde", buffer: await color("#27ae60") },
    { name: "e2e-medios-c.png", alt: "Azul", buffer: await color("#2980b9") },
  ];
  await subir(page, files);
  await expect(uploadDialog(page).getByText("Se subieron 3.")).toBeVisible();
  await uploadDialog(page).getByRole("button", { name: "Listo" }).click();
  await expect(uploadDialog(page)).toBeHidden();

  await expect(tiles(page)).toHaveCount(count(base + 3));
  // La última subida es la más nueva.
  await expect(tiles(page).nth(0)).toHaveAccessibleName("Ver detalles de Azul");
  await expect(tiles(page).nth(1)).toHaveAccessibleName("Ver detalles de Verde");
  await expect(tiles(page).nth(2)).toHaveAccessibleName("Ver detalles de Rojo");

  for (const alt of ["Azul", "Verde", "Rojo"]) {
    const src = await tile(page, alt).locator("img").getAttribute("src");
    const res = await page.request.get(src!, { headers: { Accept: "image/webp" } });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
  }
});

test("subir un archivo que ya estaba avisa en su fila y no suma miniaturas", async ({ page }) => {
  const f = await fixture();
  await subirYCerrar(page, [f]);
  await expect(tiles(page)).toHaveCount(count(base + 1));

  await subir(page, [{ ...f, alt: "Segunda vez" }]);
  await expect(uploadDialog(page).getByText("Esa imagen ya estaba subida.")).toBeVisible();
  await expect(uploadDialog(page).getByText("1 ya estaban.")).toBeVisible();
  await uploadDialog(page).getByRole("button", { name: "Listo" }).click();
  await expect(tiles(page)).toHaveCount(count(base + 1));
});

test("un archivo .txt muestra el mensaje de formato no soportado y no se sube", async ({ page }) => {
  await page.getByRole("button", { name: "Subir imágenes" }).first().click();
  await uploadDialog(page).getByLabel("Elegir archivos").setInputFiles({
    name: "notas.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no soy una imagen"),
  });
  await expect(uploadDialog(page).getByText(/Formato no soportado/)).toBeVisible();
  await expect(uploadDialog(page).getByRole("button", { name: "Subir 0 imágenes" })).toBeDisabled();
  await uploadDialog(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(uploadDialog(page)).toBeHidden();
  await expect(tiles(page)).toHaveCount(count(base));
});

test("cancelar con 2 archivos pide confirmación: Seguir editando los conserva y Descartar cierra sin subir", async ({ page }) => {
  const files: Upload[] = [
    { name: "e2e-medios-a.png", alt: "Uno", buffer: await color("#c0392b") },
    { name: "e2e-medios-b.png", alt: "Dos", buffer: await color("#27ae60") },
  ];
  await page.getByRole("button", { name: "Subir imágenes" }).first().click();
  await pick(page, files);
  await fillAlts(page, files);

  const d = uploadDialog(page);
  await d.getByRole("button", { name: "Cancelar" }).click();
  await expect(d.getByText("Tenés 2 imágenes sin subir. ¿Descartarlas?")).toBeVisible();
  await expect(d.getByRole("button", { name: "Seguir editando" })).toBeFocused();

  await d.getByRole("button", { name: "Seguir editando" }).click();
  await expect(d.getByLabel("Texto alternativo de e2e-medios-a.png")).toHaveValue("Uno");
  await expect(d.getByLabel("Texto alternativo de e2e-medios-b.png")).toHaveValue("Dos");

  await d.getByRole("button", { name: "Cancelar" }).click();
  await d.getByRole("button", { name: "Descartar" }).click();
  await expect(d).toBeHidden();
  await expect(tiles(page)).toHaveCount(count(base));
  expect(await sql("select 1 from media where original_name like 'e2e-medios-%'")).toHaveLength(0);
});

test("editar el alt de la portada del seed avisa el artículo, lo nombra al guardar y cambia el blog", async ({ page }) => {
  test.setTimeout(90_000); // tras invalidar el tag "blog", la primera visita al artículo recalcula la caché
  const nuevo = "Alt de prueba para la portada";
  await buscar(page, "Planillas sueltas");
  await tile(page, COVER_ALT).click();
  const d = detail(page, COVER_ALT);
  await d.getByRole("button", { name: "Editar" }).click();
  await expect(d.getByText(new RegExp(`Esta imagen está en uso en: ${SEED_TITLE}\\.`))).toBeVisible();
  await d.getByLabel("Texto alternativo").fill(nuevo);
  await d.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(`Cambios guardados. El texto alternativo cambió en: ${SEED_TITLE}.`)).toBeVisible();
  await detail(page, nuevo).getByRole("button", { name: "Cerrar" }).click(); // el título pasó a ser el alt nuevo

  try {
    await page.goto(`/blog/${SEED_SLUG}`);
    await expect(page.locator(`main img[alt="${nuevo}"]`).first()).toBeAttached();
  } finally {
    await page.goto("/admin/media");
    await expect(page.getByLabel(SEARCH)).toBeVisible();
    await cambiarAlt(page, nuevo, COVER_ALT);
  }
  await page.goto(`/blog/${SEED_SLUG}`);
  await expect(page.locator(`main img[alt="${COVER_ALT}"]`).first()).toBeAttached();
});

test("buscar deja las que coinciden, la URL queda con ?q= y recargar mantiene la búsqueda", async ({ page }) => {
  await buscar(page, "Planillas");
  await expect(tiles(page)).toHaveCount(1);
  await expect(tile(page, COVER_ALT)).toBeVisible();
  await expect(total(page, 1)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(SEARCH)).toHaveValue("Planillas");
  await expect(tiles(page)).toHaveCount(1);

  await page.getByLabel(SEARCH).fill("zzz-no-existe");
  await expect(page.getByText("No hay imágenes que coincidan con «zzz-no-existe».")).toBeVisible();
});

test("'Sin usar' oculta las imágenes del seed y 'En uso' las muestra", async ({ page }) => {
  const f = await fixture();
  await subirYCerrar(page, [f]);

  await buscar(page, "Planillas");
  await filtrar(page, "Sin usar");
  await expect(page).toHaveURL(/uso=sin-usar/);
  await expect(page.getByText("No hay imágenes que coincidan con «Planillas».")).toBeVisible();

  await filtrar(page, "En uso");
  await expect(page).toHaveURL(/uso=en-uso/);
  await expect(tile(page, COVER_ALT)).toBeVisible();
  await expect(tile(page, COVER_ALT)).toContainText("En uso");

  await page.getByLabel(SEARCH).fill("");
  await filtrar(page, "Sin usar");
  await expect(tile(page, f.alt)).toBeVisible();
  await expect(tile(page, COVER_ALT)).toHaveCount(0);
  await expect(tile(page, BODY_ALT)).toHaveCount(0);

  await filtrar(page, "Todas");
  await expect(page).not.toHaveURL(/uso=/);
});

test("el detalle de la portada lista el artículo y el enlace abre su editor", async ({ page }) => {
  await buscar(page, "Planillas");
  await tile(page, COVER_ALT).click();
  const d = detail(page, COVER_ALT);
  await expect(d.getByText("Sin usar")).toHaveCount(0);
  await d.getByRole("link", { name: `${SEED_TITLE} · portada` }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/[^/]+\/edit$/);
  await expect(page.getByLabel("Título del artículo")).toHaveValue(SEED_TITLE);
});

test("editar alt y nombre en el detalle los muestra sin recargar y persisten", async ({ page }) => {
  const f = await fixture();
  await subirYCerrar(page, [f]);
  await tile(page, f.alt).click();
  const d = detail(page, f.alt);
  await expect(d.getByText("800 × 600 px")).toBeVisible();

  await d.getByRole("button", { name: "Editar" }).click();
  await d.getByLabel("Texto alternativo").fill("   ");
  await d.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(d.getByText("El texto alternativo no puede estar vacío.")).toBeVisible();
  await expect(d.getByLabel("Texto alternativo")).toBeFocused();

  await d.getByLabel("Texto alternativo").fill("Alt nuevo");
  await d.getByLabel("Nombre del archivo").fill("e2e-medios-renombrada.png");
  await d.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados.", { exact: true })).toBeVisible();
  await expect(detail(page, "Alt nuevo")).toBeVisible();
  await expect(detail(page, "Alt nuevo").getByText("e2e-medios-renombrada.png")).toBeVisible();
  await detail(page, "Alt nuevo").getByRole("button", { name: "Cerrar" }).click();
  await expect(tile(page, "Alt nuevo")).toBeVisible();

  await page.reload();
  await expect(tile(page, "Alt nuevo")).toBeVisible();
  const [row] = await sql<{ original_name: string }>("select original_name from media where alt = 'Alt nuevo'");
  expect(row.original_name).toBe("e2e-medios-renombrada.png");
});

test("una imagen sin usar se borra desde el detalle con confirmación; una en uso no se puede", async ({ page }) => {
  const f = await fixture();
  await subirYCerrar(page, [f]);
  await tile(page, f.alt).click();
  const d = detail(page, f.alt);
  await d.getByRole("button", { name: "Borrar" }).click();
  const confirm = page.getByRole("dialog", { name: "¿Borrar la imagen?" });
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toBeHidden();
  await expect(d).toBeVisible();

  await d.getByRole("button", { name: "Borrar" }).click();
  await confirm.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Imagen borrada.")).toBeVisible();
  await expect(d).toBeHidden();
  await expect(tile(page, f.alt)).toHaveCount(0);
  await expect(tiles(page)).toHaveCount(count(base));

  await buscar(page, "Planillas");
  await tile(page, COVER_ALT).click();
  await expect(detail(page, COVER_ALT).getByRole("button", { name: "Borrar" })).toBeDisabled();
  await expect(page.getByText("Está en uso: quitala de esos artículos para borrarla.")).toBeVisible();
});

test("Copiar URL y Copiar id dejan el valor en el portapapeles y 'Abrir original' apunta a /media/{id}", async ({ page }) => {
  const f = await fixture();
  await subirYCerrar(page, [f]);
  const [{ id }] = await sql<{ id: string }>("select id from media where original_name = 'e2e-medios-imagen.png'");
  await tile(page, f.alt).click();
  const d = detail(page, f.alt);

  await d.getByRole("button", { name: "Copiar URL" }).click();
  await expect(d.getByText("URL copiada")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${APP}/media/${id}`);

  await d.getByRole("button", { name: "Copiar id" }).click();
  await expect(d.getByText("Id copiado")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);

  const open = d.getByRole("link", { name: "Abrir original" });
  await expect(open).toHaveAttribute("href", `/media/${id}`);
  await expect(open).toHaveAttribute("target", "_blank");
});

test("sin sesión /admin/media redirige al login y la barra lateral lleva a Medios", async ({ page, browser }) => {
  const anon = await browser.newPage();
  await anon.goto(`${APP}/admin/media`);
  await expect(anon).toHaveURL(/\/cuenta\/login/);
  await anon.close();

  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Navegación del panel" })
    .getByRole("link", { name: "Medios" })
    .click();
  await expect(page).toHaveURL(/\/admin\/media$/);
  await expect(page.getByRole("heading", { name: "Medios" })).toBeVisible();
});

test.describe("con 30 imágenes", () => {
  test.beforeEach(async ({ page }) => {
    await seedMedia(30);
    await page.reload();
    await expect(tiles(page)).toHaveCount(PAGE_SIZE);
    await expect(total(page, base + 30)).toBeVisible();
  });

  const cargarMas = async (page: Page) => {
    await page.getByRole("button", { name: "Cargar más" }).click();
    await expect(tiles(page)).toHaveCount(base + 30);
    await expect(page.getByRole("button", { name: "Cargar más" })).toHaveCount(0);
  };

  test("Cargar más deja 30 miniaturas y el botón desaparece; → desde la 24 llega a la 25", async ({ page }) => {
    await cargarMas(page);
    const siguiente = (await tiles(page).nth(PAGE_SIZE).getAttribute("aria-label"))!.replace("Ver detalles de ", "");
    await tiles(page).nth(PAGE_SIZE - 1).click();
    await page.keyboard.press("ArrowRight");
    await expect(detail(page, siguiente)).toBeVisible();
    await expect(page.getByText(`${PAGE_SIZE + 1} de ${base + 30}`)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(tiles(page).nth(PAGE_SIZE - 1)).toBeFocused();
  });

  test("borrar una imagen de la segunda tanda la saca y conserva las demás", async ({ page }) => {
    await cargarMas(page);
    await tile(page, "Semilla 30").click();
    await detail(page, "Semilla 30").getByRole("button", { name: "Borrar" }).click();
    await page.getByRole("dialog", { name: "¿Borrar la imagen?" }).getByRole("button", { name: "Borrar" }).click();
    await expect(tiles(page)).toHaveCount(base + 29);
    await expect(total(page, base + 29)).toBeVisible();
    await expect(tile(page, "Semilla 30")).toHaveCount(0);
    await expect(tile(page, "Semilla 01")).toHaveCount(1);
  });

  test("subir una imagen nueva vuelve a la primera tanda", async ({ page }) => {
    await cargarMas(page);
    const f = await fixture();
    await subirYCerrar(page, [{ ...f, alt: "Imagen nueva" }]);
    await expect(tiles(page)).toHaveCount(PAGE_SIZE);
    await expect(tiles(page).first()).toHaveAccessibleName("Ver detalles de Imagen nueva");
    await expect(total(page, base + 31)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cargar más" })).toBeVisible();
  });

  test("editar el alt de la segunda tanda lo muestra sin recargar y persiste", async ({ page }) => {
    await cargarMas(page);
    await tile(page, "Semilla 30").click();
    const d = detail(page, "Semilla 30");
    await d.getByRole("button", { name: "Editar" }).click();
    await d.getByLabel("Texto alternativo").fill("Alt de la segunda tanda");
    await d.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(detail(page, "Alt de la segunda tanda")).toBeVisible();
    await detail(page, "Alt de la segunda tanda").getByRole("button", { name: "Cerrar" }).click();
    await expect(tile(page, "Alt de la segunda tanda")).toHaveCount(1);
    await expect(tiles(page)).toHaveCount(base + 30);

    await page.reload();
    await page.getByRole("button", { name: "Cargar más" }).click();
    await expect(tiles(page)).toHaveCount(base + 30);
    await expect(tile(page, "Alt de la segunda tanda")).toHaveCount(1);
  });
});

test.describe("a 390 px", () => {
  const noHorizontalScroll = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/media");
    await expect(tiles(page).first()).toBeVisible();
  });

  test("la grilla tiene 2 columnas y los dos modales ocupan la pantalla sin scroll horizontal", async ({ page }) => {
    const columns = await page.locator("main ul").first().evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(2);
    expect(await noHorizontalScroll(page)).toBe(true);

    await tiles(page).first().click();
    const d = page.getByRole("dialog");
    const box = (await d.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(389);
    expect(box.height).toBeGreaterThanOrEqual(843);
    expect(await noHorizontalScroll(page)).toBe(true);
    await d.getByRole("button", { name: "Cerrar" }).click();

    await page.getByRole("button", { name: "Subir imágenes" }).first().click();
    const u = uploadDialog(page);
    const ubox = (await u.boundingBox())!;
    expect(ubox.width).toBeGreaterThanOrEqual(389);
    expect(ubox.height).toBeGreaterThanOrEqual(843);
    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test("los controles de la barra, la miniatura y los modales miden 44 px o más", async ({ page }) => {
    const tall = async (locators: Locator[]) => {
      for (const l of locators) {
        const box = (await l.boundingBox())!;
        expect(box.height, await l.innerText().catch(() => "control")).toBeGreaterThanOrEqual(43.5);
      }
    };
    await tall([
      page.getByLabel(SEARCH),
      page.getByRole("radiogroup").getByText("Todas", { exact: true }),
      page.getByRole("radiogroup").getByText("En uso", { exact: true }),
      page.getByRole("radiogroup").getByText("Sin usar", { exact: true }),
      tiles(page).first(),
      page.getByRole("button", { name: "Subir imágenes" }).first(),
    ]);

    await tiles(page).first().click();
    const d = page.getByRole("dialog");
    await tall([
      d.getByRole("button", { name: "Cerrar" }),
      d.getByRole("button", { name: "Imagen siguiente" }),
      d.getByRole("button", { name: "Editar" }),
      d.getByRole("button", { name: "Copiar URL" }),
      d.getByRole("button", { name: "Copiar id" }),
      d.getByRole("link", { name: "Abrir original" }),
      d.getByRole("button", { name: "Borrar" }),
    ]);
  });
});
