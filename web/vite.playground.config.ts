import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@design": path.resolve(rootDir, "./design"),
    },
  },
  root: path.resolve(rootDir, "playground"),
  publicDir: path.resolve(rootDir, "public"),
  server: {
    port: 5173,
    open: "/",
    fs: {
      allow: [rootDir],
    },
  },
  build: {
    outDir: path.resolve(rootDir, "dist-playground"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(rootDir, "playground/index.html"),
    },
  },
});
