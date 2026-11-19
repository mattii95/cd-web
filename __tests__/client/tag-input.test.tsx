import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TagInput } from "@/components/admin/article-editor/tag-input";
import type { ArticleTag } from "@/lib/admin/article-form";

const OPTIONS = [
  { slug: "atencion-al-cliente", name: "Atención al cliente" },
  { slug: "seo", name: "SEO" },
  { slug: "web", name: "Web" },
];

const nueva = (name: string): ArticleTag => ({ slug: null, name });

function Harness({
  initial = [] as ArticleTag[],
  options = OPTIONS,
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="t">Etiquetas</label>
      <TagInput id="t" value={value} options={options} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}
const value = () => JSON.parse(screen.getByTestId("value").textContent ?? "[]");

describe("TagInput", () => {
  it("Enter agrega un chip con botón para quitarlo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("combobox", { name: "Etiquetas" }), "Nube{Enter}");
    expect(value()).toEqual([nueva("Nube")]);
    expect(screen.getByRole("button", { name: "Quitar etiqueta Nube" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar etiqueta Nube" }));
    expect(value()).toEqual([]);
  });

  it("muestra «Crear …» solo para una etiqueta que no existe", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("combobox");
    await user.type(input, "Nube");
    expect(screen.getByRole("option", { name: "Crear «Nube»" })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "seo");
    expect(screen.getByRole("option", { name: "SEO" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Crear/ })).not.toBeInTheDocument();
  });

  it("autocompleta sin distinguir mayúsculas ni tildes y usa el nombre guardado", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("combobox"), "ATENCION");
    await user.click(screen.getByRole("option", { name: "Atención al cliente" }));
    expect(value()).toEqual([{ slug: "atencion-al-cliente", name: "Atención al cliente" }]);
    await user.type(screen.getByRole("combobox"), "web{Enter}");
    expect(value()).toEqual([
      { slug: "atencion-al-cliente", name: "Atención al cliente" },
      { slug: "web", name: "Web" },
    ]);
  });

  it("ignora duplicados por slug", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ slug: "seo", name: "SEO" }]} />);
    await user.type(screen.getByRole("combobox"), "seo{Enter}");
    expect(value()).toEqual([{ slug: "seo", name: "SEO" }]);
  });

  it("una etiqueta renombrada se elige por su nombre actual y conserva su slug", async () => {
    const user = userEvent.setup();
    render(<Harness options={[{ slug: "seo", name: "Posicionamiento" }]} />);
    await user.type(screen.getByRole("combobox"), "posicionamiento");
    expect(screen.queryByRole("option", { name: /Crear/ })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(value()).toEqual([{ slug: "seo", name: "Posicionamiento" }]);
  });

  it("Backspace con el input vacío quita la última", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[nueva("A"), nueva("B")]} />);
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Backspace}");
    expect(value()).toEqual([nueva("A")]);
  });

  it("con 5 chips el input se deshabilita", () => {
    render(<Harness initial={["a", "b", "c", "d", "e"].map(nueva)} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
