import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Playground must share Vite root with production so Tailwind v4 scans `src/`. */
function playgroundDevEntry(): Plugin {
  return {
    name: "epure-playground-entry",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url?.split("?")[0] ?? "";
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        if (
          raw.startsWith("/@") ||
          raw.startsWith("/api/") ||
          raw.startsWith("/playground/") ||
          raw.startsWith("/src/") ||
          raw.startsWith("/node_modules/") ||
          raw.startsWith("/design/") ||
          /\.[a-zA-Z0-9]+$/.test(raw)
        ) {
          next();
          return;
        }
        if (raw === "/" || raw === "/index.html" || !raw.includes(".")) {
          req.url = "/playground/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_EPURE_PLAYGROUND": JSON.stringify("1"),
  },
  root: rootDir,
  publicDir: path.resolve(rootDir, "public"),
  plugins: [react(), tailwindcss(), playgroundDevEntry()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@design": path.resolve(rootDir, "./design"),
    },
  },
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
