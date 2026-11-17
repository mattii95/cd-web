import { describe, expect, it } from "vitest";
import { avatarSrc } from "@/lib/auth/avatar";

describe("avatarSrc", () => {
  it("acepta https de Google y GitHub", () => {
    const g = "https://lh3.googleusercontent.com/a/abc=s96-c";
    const h = "https://avatars.githubusercontent.com/u/1?v=4";
    expect(avatarSrc(g)).toBe(g);
    expect(avatarSrc(h)).toBe(h);
  });

  it("devuelve null para http, data: y hosts no permitidos", () => {
    expect(avatarSrc("http://lh3.googleusercontent.com/a")).toBeNull();
    expect(avatarSrc("data:image/png;base64,AAAA")).toBeNull();
    expect(avatarSrc("https://evil.com/a.png")).toBeNull();
    expect(
      avatarSrc("https://lh3.googleusercontent.com.evil.com/a"),
    ).toBeNull();
  });

  it("devuelve null para vacío o una URL inválida", () => {
    expect(avatarSrc(null)).toBeNull();
    expect(avatarSrc("")).toBeNull();
    expect(avatarSrc("no es una url")).toBeNull();
  });
});
