import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostThumb } from "@/components/blog/post-thumb";

const cover = {
  src: "/blog/senales-portada.webp",
  width: 1920,
  height: 1080,
  alt: "Diagrama de un sistema a medida",
};

describe("PostThumb", () => {
  it("sin cover dibuja la categoría como antes", () => {
    const { container } = render(<PostThumb category="sistemas" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("// sistemas");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it.each(["card", "featured"] as const)(
    "con cover en %s la imagen es decorativa (alt vacío)",
    (variant) => {
      const { container } = render(
        <PostThumb category="sistemas" cover={cover} variant={variant} />,
      );
      expect(container.querySelector("img")).toHaveAttribute("alt", "");
      expect(container).not.toHaveTextContent("// sistemas");
    },
  );

  it("con cover en banner usa el alt de la imagen", () => {
    const { container } = render(
      <PostThumb category="sistemas" cover={cover} variant="banner" />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", cover.alt);
  });
});
