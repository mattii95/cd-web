import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getScore,
  PasswordStrength,
} from "@/components/auth/password-strength";

describe("getScore", () => {
  it("suma un punto por cada regla", () => {
    expect(getScore("")).toBe(0);
    expect(getScore("abcdefgh")).toBe(1); // largo
    expect(getScore("Ab")).toBe(1); // mayúscula y minúscula
    expect(getScore("1")).toBe(1); // número
    expect(getScore("!")).toBe(1); // símbolo
    expect(getScore("Abcdef1!")).toBe(4);
  });
});

describe("PasswordStrength", () => {
  // Los segmentos no tienen rol ni texto: se cuentan por la clase del segmento activo.
  const activeSegments = (container: HTMLElement) =>
    container.querySelectorAll(".bg-accent").length;

  it("vacío pide escribir una contraseña y no activa segmentos", () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(screen.getByText("Escribí una contraseña")).toBeInTheDocument();
    expect(activeSegments(container)).toBe(0);
  });

  it("muestra la etiqueta y los segmentos según el puntaje", () => {
    const { container } = render(<PasswordStrength password="Abcdef1!" />);
    expect(screen.getByText("Fuerte")).toBeInTheDocument();
    expect(activeSegments(container)).toBe(4);
  });

  it("una contraseña no vacía con puntaje 0 se muestra como Débil", () => {
    const { container } = render(<PasswordStrength password="a" />);
    expect(screen.getByText("Débil")).toBeInTheDocument();
    expect(activeSegments(container)).toBe(0);
  });
});
