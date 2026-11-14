import { expect, test } from "./fixtures";

for (const ruta of ["/", "/cuenta/login"]) {
  test(`${ruta} no tiene scroll horizontal`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "solo en el proyecto mobile");
    await page.goto(ruta);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
