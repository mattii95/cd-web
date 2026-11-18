import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleBody } from "@/components/blog/article-body";
import { ArticleToc } from "@/components/blog/article-toc";
import type { BlogInline, BlogMark, ResolvedBlogDoc } from "@/db/blog-body";

const image = {
  src: "/blog/senales-diagrama.webp",
  width: 1600,
  height: 900,
  alt: "Cinco señales en una línea de tiempo",
};

const t = (text: string, marks?: BlogMark[]): BlogInline => ({
  type: "text",
  text,
  marks,
});
const doc = (...content: ResolvedBlogDoc["content"]): ResolvedBlogDoc => ({
  type: "doc",
  content,
});
const p = (...content: BlogInline[]) =>
  ({ type: "paragraph", content }) as const;
const li = (...content: Parameters<typeof doc>) =>
  ({ type: "listItem", content }) as never;

describe("ArticleBody", () => {
  it("renderiza un nodo image con figure, img y figcaption", () => {
    const { container } = render(
      <ArticleBody
        body={doc({ type: "image", attrs: { image, caption: "Figura 1" } })}
      />,
    );
    expect(container.querySelector("figure")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", image.alt);
    expect(container.querySelector("figcaption")).toHaveTextContent("Figura 1");
  });

  it("sin caption no renderiza figcaption", () => {
    const { container } = render(
      <ArticleBody
        body={doc({ type: "image", attrs: { image, caption: null } })}
      />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("H2 con id y número; H3 sin id ni número", () => {
    const { container } = render(
      <ArticleBody
        body={doc(
          { type: "heading", attrs: { level: 2 }, content: [t("Uno")] },
          { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
          { type: "heading", attrs: { level: 2 }, content: [t("Dos")] },
        )}
      />,
    );
    const h2 = container.querySelectorAll("h2");
    expect(h2[0]).toHaveAttribute("id", "s1");
    expect(h2[0]).toHaveTextContent("01");
    expect(h2[1]).toHaveAttribute("id", "s2");
    expect(h2[1]).toHaveTextContent("02");
    const h3 = container.querySelector("h3");
    expect(h3).toHaveTextContent("Sub");
    expect(h3).not.toHaveAttribute("id");
    expect(h3).not.toHaveTextContent(/\d/);
  });

  it("bold, italic y hardBreak", () => {
    const { container } = render(
      <ArticleBody
        body={doc(
          p(
            t("a", [{ type: "bold" }]),
            { type: "hardBreak" },
            t("b", [{ type: "italic" }]),
          ),
        )}
      />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("a");
    expect(container.querySelector("em")).toHaveTextContent("b");
    expect(container.querySelector("br")).toBeInTheDocument();
  });

  it("enlace externo abre en otra pestaña; interno no", () => {
    render(
      <ArticleBody
        body={doc(
          p(
            t("ext", [
              { type: "link", attrs: { href: "https://ejemplo.com" } },
            ]),
            t("int", [{ type: "link", attrs: { href: "/servicios" } }]),
          ),
        )}
      />,
    );
    const ext = screen.getByRole("link", { name: "ext" });
    expect(ext).toHaveAttribute("target", "_blank");
    expect(ext).toHaveAttribute("rel", "noopener noreferrer");
    const int = screen.getByRole("link", { name: "int" });
    expect(int).toHaveAttribute("href", "/servicios");
    expect(int).not.toHaveAttribute("target");
  });

  it("listas, lista anidada y cita", () => {
    const { container } = render(
      <ArticleBody
        body={doc(
          {
            type: "bulletList",
            content: [
              li(p(t("a")), {
                type: "bulletList",
                content: [li(p(t("anidado")))],
              }),
            ],
          },
          {
            type: "orderedList",
            attrs: { start: 3 },
            content: [li(p(t("c")))],
          },
          { type: "blockquote", content: [p(t("cita"))] },
        )}
      />,
    );
    expect(container.querySelector("ul li ul li")).toHaveTextContent("anidado");
    expect(container.querySelector("ol")).toHaveAttribute("start", "3");
    expect(container.querySelector("blockquote")).toHaveTextContent("cita");
  });

  it("un párrafo vacío no genera <p>", () => {
    const { container } = render(
      <ArticleBody body={doc({ type: "paragraph" })} />,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("tip y summary muestran su título, texto y marcas", () => {
    const { container } = render(
      <ArticleBody
        body={doc(
          { type: "tip", content: [t("útil", [{ type: "bold" }])] },
          { type: "summary", content: [t("resumen")] },
        )}
      />,
    );
    expect(screen.getByText("Consejo")).toBeInTheDocument();
    expect(screen.getByText("En resumen")).toBeInTheDocument();
    expect(
      container.querySelector("aside strong + span strong"),
    ).toHaveTextContent("útil");
    expect(screen.getByText("resumen")).toBeInTheDocument();
  });
});

describe("ArticleToc", () => {
  it("lista solo los H2 con sus anclas", () => {
    render(
      <ArticleToc
        body={doc(
          { type: "heading", attrs: { level: 2 }, content: [t("Uno")] },
          { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
          { type: "heading", attrs: { level: 2 }, content: [t("Dos")] },
        )}
      />,
    );
    expect(screen.getByRole("link", { name: /Uno/ })).toHaveAttribute(
      "href",
      "#s1",
    );
    expect(screen.getByRole("link", { name: /Dos/ })).toHaveAttribute(
      "href",
      "#s2",
    );
    expect(screen.queryByText("Sub")).toBeNull();
  });
});
