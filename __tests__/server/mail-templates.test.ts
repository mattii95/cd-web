import { describe, expect, it } from "vitest";
import {
  existingAccountEmail,
  resetPasswordEmail,
  verificationEmail,
} from "@/lib/mail/templates";

const url = "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=/x";

describe("plantillas de email", () => {
  it("la verificación incluye el link y el nombre en html y texto", () => {
    const mail = verificationEmail("Ana", url);
    expect(mail.subject).toBe("Verificá tu email");
    expect(mail.text).toContain(url);
    expect(mail.text).toContain("Hola Ana");
    expect(mail.html).toContain("token=abc&amp;callbackURL=/x");
  });

  it("la recuperación avisa que el link vence en 1 hora", () => {
    const mail = resetPasswordEmail("Ana", url);
    expect(mail.subject).toBe("Recuperá tu contraseña");
    expect(mail.text).toContain("1 hora");
    expect(mail.text).toContain(url);
  });

  it("el aviso de cuenta existente lleva el link de login", () => {
    const mail = existingAccountEmail("Ana", "http://localhost:3000/cuenta/login");
    expect(mail.subject).toBe("Ya tenés una cuenta");
    expect(mail.text).toContain("http://localhost:3000/cuenta/login");
  });

  it("escapa el html del nombre", () => {
    const mail = verificationEmail("<script>x</script>", url);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
