import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Build multipage para extension MV3.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Entradas para popup/options/blocked y scripts de background/content.
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/ui/popup/index.html"),
        options: resolve(__dirname, "src/ui/options/index.html"),
        blocked: resolve(__dirname, "src/ui/blocked/index.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]"
      }
    }
  }
});
