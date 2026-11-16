// Genera los WebP de demo de public/blog/ desde los SVG de esta carpeta.
// Uso: npx tsx scripts/demo-images/build.ts
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

async function main() {
  for (const name of ["senales-portada", "senales-diagrama"]) {
    const svg = await readFile(`scripts/demo-images/${name}.svg`);
    const out = await sharp(svg).webp({ quality: 82 }).toBuffer();
    await writeFile(`public/blog/${name}.webp`, out);
    console.log(name, out.length, "bytes");
  }
}

main();
