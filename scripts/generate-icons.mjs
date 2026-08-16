import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, "icon.svg");
const outDir = path.join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const sizes = [192, 256, 384, 512];

for (const size of sizes) {
  await sharp(svgPath).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`icon-${size}.png ok`);
}

// Apple touch icon (sin transparencia, 180x180 es el tamaño recomendado por Apple)
await sharp(svgPath).resize(180, 180).png().toFile(path.join(outDir, "apple-touch-icon.png"));
console.log("apple-touch-icon.png ok");

// Favicon
await sharp(svgPath).resize(32, 32).png().toFile(path.join(__dirname, "..", "src", "app", "icon.png"));
console.log("app/icon.png ok");
