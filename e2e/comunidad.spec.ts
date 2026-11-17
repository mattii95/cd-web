import { expect, test } from "./fixtures";
import { E2E_AUTHOR } from "./global-setup";
import {
  PASSWORD,
  clearRateLimit,
  createVerifiedUser,
  login,
  sql,
  uniqueEmail,
} from "./helpers";

// Los límites de comentarios y de intentos son compartidos: en serie, solo en desktop
// (ver testIgnore en playwright.config.ts), y cada test parte sin intentos acumulados.
test.describe.configure({ mode: "serial" });

const SLUG = "senales-sistema-a-medida";
const PREFIX = "e2e-comunidad-";
const USER_PREFIX = "comunidad";

// El footer enlaza a /privacidad y /terminos, que todavía no existen: su prefetch da 404
// y la consola lo informa. Se descuentan igual que en blog.spec.
let esperadas404: number;

test.beforeEach(async ({ page }) => {
  await clearRateLimit();
  esperadas404 = 0;
  page.on("response", (r) => {
    if (r.status() === 404 && /\/(privacidad|terminos)\?/.test(r.url()))
      esperadas404++;
  });
});

test.afterEach(async ({ consoleErrors }) => {
  // Primero los posts: post.author_id es restrict; los comentarios caen por cascade.
  await sql("delete from post where slug like $1", [`${PREFIX}%`]);
  await sql(`delete from "user" where email like $1`, [
    `${USER_PREFIX}-%@test.com`,
  ]);
  if (esperadas404) {
    for (let i = consoleErrors.length - 1; i >= 0; i--) {
      if (/status of 404/.test(consoleErrors[i])) consoleErrors.splice(i, 1);
    }
  }
});

async function entrar(
  page: import("@playwright/test").Page,
  volver: string,
  name: string,
) {
  const { email } = await createVerifiedUser(uniqueEmail(USER_PREFIX), name);
  await login(page, email, PASSWORD, volver);
  await expect(page).toHaveURL(new RegExp(volver.replace(/[/#]/g, "\\$&")));
  // Los campos son controlados: si se tipea antes de hidratar, React los vacía.
  await page.waitForLoadState("networkidle");
  return email;
}

const comentario = (page: import("@playwright/test").Page, texto: string) =>
  page.getByRole("listitem").filter({ hasText: texto });

test("un lector valora, comenta, vota Útil y borra su comentario", async ({
  page,
}) => {
  const email = await entrar(page, `/blog/${SLUG}`, "Beto Comunidad");
  const main = page.getByRole("main");
  await expect(main.getByText("Tu valoración")).toBeVisible();
  const valoraciones = () =>
    sql<{ n: string }>(
      "select count(*)::text n from post_rating where post_id = (select id from post where slug = $1)",
      [SLUG],
    ).then(([r]) => Number(r.n));
  const antes = await valoraciones();

  // Valorar: guarda al elegir y el total sube en uno.
  await main.getByRole("radio", { name: "4 estrellas" }).click();
  await expect.poll(valoraciones).toBe(antes + 1);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(
    main.getByRole("radio", { name: "4 estrellas" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    main.getByText(`${antes + 1} valoraciones`).first(),
  ).toBeVisible();

  // Comentar: nace pendiente, solo lo ve su autor.
  const texto = `Comentario e2e ${Date.now()}`;
  const publicar = main.getByRole("button", { name: "Publicar" });
  await expect(publicar).toBeDisabled();
  await main
    .getByRole("textbox", { name: "Escribí un comentario" })
    .fill(texto);
  await publicar.click();
  await expect(
    main.getByText("Tu comentario quedó en revisión."),
  ).toBeVisible();
  await expect(comentario(page, texto).getByText("En revisión")).toBeVisible();
  await page.reload();
  await expect(comentario(page, texto).getByText("En revisión")).toBeVisible();

  // Útil en el comentario de Lucía: toggle con aria-pressed, que sobrevive a la recarga.
  const lucia = comentario(page, "Lucía Fernández");
  const util = lucia.getByRole("button", { name: /^Útil · \d+$/ });
  await expect(util).toHaveAttribute("aria-pressed", "false");
  const base = Number((await util.textContent())!.match(/\d+/)![0]);
  await util.click();
  await expect(
    lucia.getByRole("button", { name: `Útil · ${base + 1}` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(util).toHaveAttribute("aria-pressed", "true");
  // Se quita el voto: el borrado de abajo refresca la caché y no debe dejar el voto contado.
  await util.click();
  await expect(util).toHaveAttribute("aria-pressed", "false");
  await expect(util).toHaveText(`Útil · ${base}`);

  // Borrar con confirmación inline.
  await comentario(page, texto).getByRole("button", { name: "Borrar" }).click();
  await comentario(page, texto)
    .getByRole("button", { name: "Sí, borrar" })
    .click();
  await expect(main.getByText(texto)).toHaveCount(0);
  await page.reload();
  await expect(main.getByText(texto)).toHaveCount(0);

  // El borrado llegó a la base.
  const [{ n }] = await sql<{ n: string }>(
    `select count(*)::text n from comment where user_id = (select id from "user" where email = $1)`,
    [email],
  );
  expect(n).toBe("0");
});

test("un lector ve su comentario en el perfil y lo borra desde ahí", async ({
  page,
}) => {
  await entrar(page, `/blog/${SLUG}`, "Ana Comunidad");
  const texto = `Comentario perfil ${Date.now()}`;
  const main = page.getByRole("main");
  await main
    .getByRole("textbox", { name: "Escribí un comentario" })
    .fill(texto);
  await main.getByRole("button", { name: "Publicar" }).click();
  await expect(
    main.getByText("Tu comentario quedó en revisión."),
  ).toBeVisible();

  await page.goto("/cuenta/perfil");
  await page.waitForLoadState("networkidle");
  await expect(
    main.getByRole("heading", { name: "Mis comentarios" }),
  ).toBeVisible();
  const item = comentario(page, texto);
  await expect(item.getByText("En revisión")).toBeVisible();
  await expect(item.getByRole("link", { name: /señales/i })).toHaveAttribute(
    "href",
    `/blog/${SLUG}#valoraciones`,
  );

  await item.getByRole("button", { name: "Borrar" }).click();
  await item.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(main.getByText(texto)).toHaveCount(0);
  await expect(
    main.getByText("Todavía no comentaste ningún artículo."),
  ).toBeVisible();
  await page.reload();
  await expect(
    main.getByText("Todavía no comentaste ningún artículo."),
  ).toBeVisible();
});

test("el autor del post responde, edita y borra la respuesta", async ({
  page,
}) => {
  // El autor del seed no tiene contraseña: el post y el comentario se crean acá.
  const email = uniqueEmail(USER_PREFIX);
  await createVerifiedUser(email, "Autora Comunidad");
  const slug = `${PREFIX}autor`;
  const texto = `Pregunta del lector ${Date.now()}`;
  const [{ id }] = await sql<{ id: string }>(
    `insert into post (id, slug, title, excerpt, body, cta, reading_minutes, category_id, author_id, status, published_at)
     values (gen_random_uuid()::text, $1, $1, 'extracto', '[{"type":"p","text":"texto"}]'::jsonb, 'cta', 3,
             (select id from category where slug = 'sistemas'), (select id from "user" where email = $2),
             'publicado', make_timestamp(2026, 11, 13, 12, 0, 0))
     returning id`,
    [slug, email],
  );
  await sql(
    `insert into comment (id, post_id, user_id, text, status)
     values (gen_random_uuid()::text, $1, (select id from "user" where email = $2), $3, 'aprobado')`,
    [id, E2E_AUTHOR, texto],
  );

  await login(page, email, PASSWORD, `/blog/${slug}`);
  await expect(page).toHaveURL(new RegExp(slug));
  await page.waitForLoadState("networkidle");
  const item = comentario(page, texto);
  const area = item.getByRole("textbox", { name: "Escribí una respuesta" });

  await item.getByRole("button", { name: "Responder" }).click();
  await area.fill("Gracias por escribir");
  await item.getByRole("button", { name: "Publicar respuesta" }).click();
  await expect(item.getByText("Gracias por escribir")).toBeVisible();
  await expect(item.getByText("Autor", { exact: true })).toBeVisible();

  await item.getByRole("button", { name: "Editar" }).click();
  await expect(area).toHaveValue("Gracias por escribir");
  await area.fill("Respuesta editada");
  await item.getByRole("button", { name: "Publicar respuesta" }).click();
  await expect(item.getByText("Respuesta editada")).toBeVisible();
  await expect(item.getByText("Gracias por escribir")).toHaveCount(0);

  await item.getByRole("button", { name: "Borrar" }).click();
  await item.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(item.getByText("Respuesta editada")).toHaveCount(0);
  await expect(item.getByRole("button", { name: "Responder" })).toBeVisible();
});
