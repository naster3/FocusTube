import { defineConfig } from "vite";
import { resolve } from "path";

// Build separado para content script sin imports (IIFE).
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/content/index.ts"),
      output: {
        format: "iife",
        name: "FocusTubeContent",
        entryFileNames: "content.js",
        inlineDynamicImports: true
      }
    }
  }
});
