import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MEDIA_LIMITS, MediaError, processImage } from "@/lib/media/process";

const blank = (width: number, height: number) => ({
  create: { width, height, channels: 3 as const, background: "#3366cc" },
});

describe("processImage", () => {
  it("reduce un JPEG de 4000×3000 a WebP de 1920×1440", async () => {
    const jpeg = await sharp(blank(4000, 3000)).jpeg().toBuffer();
    const out = await processImage(jpeg);
    expect(out).toMatchObject({ width: 1920, height: 1440 });
    expect((await sharp(out.data).metadata()).format).toBe("webp");
    expect(out.sha256).toBe(createHash("sha256").update(jpeg).digest("hex"));
  });

  it("no agranda un PNG de 800×600", async () => {
    const png = await sharp(blank(800, 600)).png().toBuffer();
    const out = await processImage(png);
    expect(out).toMatchObject({ width: 800, height: 600 });
  });

  it("gira según EXIF orientación 6 y borra EXIF y GPS", async () => {
    const jpeg = await sharp(blank(400, 200))
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).orientation).toBe(6);

    const out = await processImage(jpeg);
    expect(out).toMatchObject({ width: 200, height: 400 });
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("rechaza un GIF", async () => {
    const gif = await sharp(blank(10, 10)).gif().toBuffer();
    await expect(processImage(gif)).rejects.toBeInstanceOf(MediaError);
  });

  it("rechaza un texto renombrado a .jpg", async () => {
    await expect(processImage(Buffer.from("hola, no soy una imagen"))).rejects.toBeInstanceOf(
      MediaError,
    );
  });

  it("rechaza más de 10 MB", async () => {
    const big = Buffer.alloc(MEDIA_LIMITS.maxBytes + 1);
    await expect(processImage(big)).rejects.toThrow(/10 MB/);
  });

  it("rechaza más de 40 megapíxeles", async () => {
    const png = await sharp(blank(7000, 6000)).png({ compressionLevel: 9 }).toBuffer();
    await expect(processImage(png)).rejects.toThrow(/megapíxeles/);
  });
});
