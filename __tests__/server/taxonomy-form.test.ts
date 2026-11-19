import { describe, expect, it } from "vitest";
import { parseCategoryForm, parseTagForm } from "@/lib/admin/taxonomy-form";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}
const categoria = (over: Record<string, string> = {}) =>
  form({
    label: "Marketing digital",
    filterLabel: "Marketing",
    slug: "marketing-digital",
    serviceSlug: "desarrollo-web",
    icon: "bolt",
    ...over,
  });
const erroresDe = (r: ReturnType<typeof parseCategoryForm>) => (r.ok ? null : r.fieldErrors);

describe("parseCategoryForm", () => {
  it("con todo válido devuelve el input y el id", () => {
    expect(parseCategoryForm(categoria())).toEqual({
      ok: true,
      id: null,
      input: {
        label: "Marketing digital",
        filterLabel: "Marketing",
        slug: "marketing-digital",
        serviceSlug: "desarrollo-web",
        icon: "bolt",
      },
    });
    const r = parseCategoryForm(categoria({ id: "abc" }));
    expect(r.ok && r.id).toBe("abc");
  });

  it("recorta y junta los espacios del nombre", () => {
    const r = parseCategoryForm(categoria({ label: "  Marketing   digital " }));
    expect(r.ok && r.input.label).toBe("Marketing digital");
  });

  it.each([
    ["sin nombre", { label: "  " }, "label"],
    ["nombre de 41 caracteres", { label: "a".repeat(41) }, "label"],
    ["nombre de 40 caracteres pasa", { label: "a".repeat(40), slug: "a" }, null],
    ["slug Mal Slug", { slug: "Mal Slug" }, "slug"],
    ["sin slug", { slug: "" }, "slug"],
    ["servicio otro", { serviceSlug: "otro" }, "serviceSlug"],
    ["sin servicio", { serviceSlug: "" }, "serviceSlug"],
    ["ícono star", { icon: "star" }, "icon"],
    ["sin ícono", { icon: "" }, "icon"],
    ["texto del filtro vacío", { filterLabel: "" }, "filterLabel"],
    ["texto del filtro de 41", { filterLabel: "a".repeat(41) }, "filterLabel"],
  ])("%s", (_, over, field) => {
    const e = erroresDe(parseCategoryForm(categoria(over)));
    if (field) expect(e).toHaveProperty(field);
    else expect(e).toBeNull();
  });

  it("junta varios errores a la vez", () => {
    const e = erroresDe(parseCategoryForm(categoria({ serviceSlug: "", icon: "" })));
    expect(Object.keys(e ?? {}).sort()).toEqual(["icon", "serviceSlug"]);
  });
});

describe("parseTagForm", () => {
  it("con todo válido devuelve el input", () => {
    expect(parseTagForm(form({ name: " Atención  al cliente ", slug: "atencion" }))).toEqual({
      ok: true,
      id: null,
      input: { name: "Atención al cliente", slug: "atencion" },
    });
  });

  it.each([
    ["sin nombre", { name: "", slug: "a" }],
    ["nombre de 41 caracteres", { name: "a".repeat(41), slug: "a" }],
    ["nombre que da slugify vacío", { name: "¡¿?!", slug: "a" }],
  ])("%s → error en name", (_, fields) => {
    const r = parseTagForm(form(fields));
    expect(!r.ok && r.fieldErrors).toHaveProperty("name");
  });

  it("slug inválido → error en slug", () => {
    const r = parseTagForm(form({ name: "SEO", slug: "Mal Slug" }));
    expect(!r.ok && r.fieldErrors).toHaveProperty("slug");
  });
});
