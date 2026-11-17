import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButtons, shareLinks } from "@/components/blog/share-button";

const TITLE = "5 señales & un sistema";
const URL_ = "https://courrouxdigital.com/blog/senales-sistema-a-medida";

describe("shareLinks", () => {
  it("codifica título y URL en cada red", () => {
    const links = Object.fromEntries(shareLinks(TITLE, URL_).map((l) => [l.name, l.href]));
    const t = encodeURIComponent(TITLE);
    const u = encodeURIComponent(URL_);
    expect(links).toEqual({
      WhatsApp: `https://wa.me/?text=${t}%20${u}`,
      LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      X: `https://x.com/intent/post?text=${t}&url=${u}`,
      Facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      Telegram: `https://t.me/share/url?url=${u}&text=${t}`,
      email: `mailto:?subject=${t}&body=${u}`,
    });
    expect(links.X).toContain("5%20se%C3%B1ales%20%26%20un%20sistema");
  });
});

describe("ShareButtons", () => {
  afterEach(() => vi.restoreAllMocks());

  it("muestra un enlace por red, que abre en otra pestaña salvo el email", () => {
    render(<ShareButtons title={TITLE} url={URL_} />);
    for (const name of ["WhatsApp", "LinkedIn", "X", "Facebook", "Telegram"]) {
      const link = screen.getByRole("link", { name: `Compartir por ${name}` });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("href")).toContain(encodeURIComponent(URL_));
    }
    expect(screen.getByRole("link", { name: "Compartir por email" })).not.toHaveAttribute(
      "target",
    );
  });

  it("Copiar link copia la URL y avisa", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ShareButtons title={TITLE} url={URL_} />);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(await screen.findByRole("status")).toHaveTextContent("Link copiado");
  });

  it("si no se puede copiar, lo dice", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("no"));
    render(<ShareButtons title={TITLE} url={URL_} />);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No se pudo copiar");
  });

  it("sin navigator.share (jsdom no lo trae) no ofrece Más opciones", () => {
    render(<ShareButtons title={TITLE} url={URL_} />);
    expect(
      screen.queryByRole("button", { name: "Más opciones para compartir" }),
    ).not.toBeInTheDocument();
  });

  it("con navigator.share, Más opciones abre el panel del sistema", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    try {
      render(<ShareButtons title={TITLE} url={URL_} />);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Más opciones para compartir" }));
      expect(share).toHaveBeenCalledWith({ title: TITLE, url: URL_ });
    } finally {
      delete (navigator as { share?: unknown }).share;
    }
  });
});
