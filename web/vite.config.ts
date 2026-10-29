import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { orbitPackageRoot, stylexPlugin } from "./vite.stylex";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [stylexPlugin(), react(), tailwindcss()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react-is",
      "prop-types",
      "use-sync-external-store",
      "@tanstack/react-table",
    ],
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@design": path.resolve(rootDir, "./design"),
      "react-is": path.resolve(rootDir, "node_modules/react-is"),
      "prop-types": path.resolve(rootDir, "node_modules/prop-types"),
      "use-sync-external-store": path.resolve(
        rootDir,
        "node_modules/use-sync-external-store",
      ),
      "@tanstack/react-table": path.resolve(
        rootDir,
        "node_modules/@tanstack/react-table",
      ),
    },
  },
  server: {
    fs: {
      allow: [rootDir, orbitPackageRoot],
    },
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  optimizeDeps: {
    include: [
      "react-is",
      "prop-types",
      "use-sync-external-store",
      "use-sync-external-store/shim/with-selector",
      "@tanstack/react-table",
      "lucide-react",
      "@phosphor-icons/react",
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
