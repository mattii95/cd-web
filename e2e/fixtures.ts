import { expect, test as base } from "@playwright/test";

// Todos los E2E fallan si la página emite un error de consola o una excepción.
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await use(errors);
      expect(errors, "errores de consola").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
