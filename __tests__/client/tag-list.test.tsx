import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TagList } from "@/components/blog/tag-list";

const tags = [
  { slug: "pymes", name: "Pymes" },
  { slug: "seo", name: "SEO" },
] as const;

describe("TagList", () => {
  it("renderiza una lista con aria-label y un li por etiqueta", () => {
    render(<TagList tags={[...tags]} />);
    const list = screen.getByRole("list", { name: "Etiquetas" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Pymes", "SEO"]);
  });

  it("no renderiza nada sin etiquetas", () => {
    const { container } = render(<TagList tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("los chips no son enlaces ni botones", () => {
    render(<TagList tags={[...tags]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
