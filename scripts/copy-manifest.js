import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

// Copia manifest base y htmls a dist/.
const root = process.cwd();
const dist = resolve(root, "dist");
const publicDir = resolve(root, "public");
const manifestBase = resolve(root, "src", "manifest", "manifest.base.json");

mkdirSync(dist, { recursive: true });
copyFileSync(manifestBase, resolve(dist, "manifest.json"));

copyFileSync(
  resolve(root, "dist", "src", "ui", "popup", "index.html"),
  resolve(dist, "popup.html")
);
copyFileSync(
  resolve(root, "dist", "src", "ui", "options", "index.html"),
  resolve(dist, "options.html")
);
copyFileSync(
  resolve(root, "dist", "src", "ui", "blocked", "index.html"),
  resolve(dist, "blocked.html")
);

// Copia recursiva de assets (icons).
const copyRecursive = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const srcPath = resolve(from, entry);
    const destPath = resolve(to, entry);
    if (statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};

const iconsDir = resolve(publicDir, "icons");
copyRecursive(iconsDir, resolve(dist, "icons"));
