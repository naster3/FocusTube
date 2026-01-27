import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Build multipage para extension MV3.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      fs: resolve(__dirname, "src/shims/fs.ts"),
      path: resolve(__dirname, "src/shims/path.ts"),
      crypto: resolve(__dirname, "src/shims/crypto.ts")
    }
  },
  optimizeDeps: {
    exclude: ["sql.js"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    commonjsOptions: {
      include: [/sql\.js/, /node_modules/]
    },
    // Entradas para popup/options/blocked y scripts de background/content.
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/ui/popup/index.html"),
        options: resolve(__dirname, "src/ui/options/index.html"),
        dashboard: resolve(__dirname, "src/ui/dashboard/index.html"),
        help: resolve(__dirname, "src/ui/help/index.html"),
        blocked: resolve(__dirname, "src/ui/blocked/index.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunk-[name].js",
        assetFileNames: "[name].[ext]"
      }
    }
  }
});
