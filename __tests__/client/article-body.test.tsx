import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleBody } from "@/components/blog/article-body";

const image = {
  src: "/blog/senales-diagrama.webp",
  width: 1600,
  height: 900,
  alt: "Cinco señales en una línea de tiempo",
};

describe("ArticleBody", () => {
  it("renderiza un bloque image con figure, img y figcaption", () => {
    const { container } = render(
      <ArticleBody body={[{ type: "image", image, caption: "Figura 1" }]} />,
    );
    expect(container.querySelector("figure")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", image.alt);
    expect(container.querySelector("figcaption")).toHaveTextContent("Figura 1");
  });

  it("sin caption no renderiza figcaption", () => {
    const { container } = render(
      <ArticleBody body={[{ type: "image", image }]} />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });
});
