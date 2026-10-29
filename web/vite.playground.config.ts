import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { orbitPackageRoot, stylexPlugin } from "./vite.stylex";

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
          raw.startsWith("/virtual:") ||
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
  // Keep dep cache off the main app's node_modules/.vite — concurrent
  // `vite` + `vite.playground` otherwise stampede optimizeDeps → 504 Outdated Optimize Dep / blank root.
  cacheDir: path.resolve(rootDir, "node_modules/.vite-playground"),
  // StyleX before React (official StyleX Vite order).
  plugins: [stylexPlugin(), react(), tailwindcss(), playgroundDevEntry()],
  resolve: {
    // Orbit vendors nested CJS (@mui / react-is / hoist-non-react-statics). Serving those
    // via /@fs/... as ESM breaks named/default imports → blank root. Force web copies.
    dedupe: [
      "react",
      "react-dom",
      "react-is",
      "prop-types",
      "hoist-non-react-statics",
      "use-sync-external-store",
      "@tanstack/react-table",
      "@mui/material",
      "@mui/icons-material",
      "@mui/utils",
      "@emotion/react",
      "@emotion/styled",
    ],
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@design": path.resolve(rootDir, "./design"),
      "react-is": path.resolve(rootDir, "node_modules/react-is"),
      "prop-types": path.resolve(rootDir, "node_modules/prop-types"),
      "hoist-non-react-statics": path.resolve(
        rootDir,
        "node_modules/hoist-non-react-statics",
      ),
      "use-sync-external-store": path.resolve(
        rootDir,
        "node_modules/use-sync-external-store",
      ),
      "@tanstack/react-table": path.resolve(
        rootDir,
        "node_modules/@tanstack/react-table",
      ),
      "@mui/material": path.resolve(rootDir, "node_modules/@mui/material"),
      "@mui/icons-material": path.resolve(rootDir, "node_modules/@mui/icons-material"),
      "@mui/utils": path.resolve(rootDir, "node_modules/@mui/utils"),
      "@emotion/react": path.resolve(rootDir, "node_modules/@emotion/react"),
      "@emotion/styled": path.resolve(rootDir, "node_modules/@emotion/styled"),
    },
  },
  server: {
    port: 5173,
    open: "/",
    fs: {
      // Orbit package source only — never serve its nested node_modules via /@fs
      allow: [rootDir, path.join(orbitPackageRoot, "src")],
    },
  },
  /**
   * StyleX + eager design-kit graph was deadlocking Vite's dep crawler:
   * `.vite/deps` never appeared and `/node_modules/.vite/deps/react.js` hung forever
   * → blank page (root never mounts). Skip discovery; prebundle a fixed allowlist.
   * Prebundle CJS packages so esbuild interop fixes named/default exports for MUI.
   */
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react/jsx-dev-runtime",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-is",
      "prop-types",
      "hoist-non-react-statics",
      "use-sync-external-store",
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
      "@tanstack/react-table",
      "@mui/material",
      "@mui/icons-material",
      "@mui/utils",
      "@emotion/react",
      "@emotion/styled",
      "react-router",
      "react-router/dom",
      "react-router-dom",
      "@tanstack/react-query",
      "nuqs",
      "nuqs/adapters/react-router/v7",
      "sonner",
      "@stylexjs/stylex",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "@radix-ui/react-slot",
      "cmdk",
      "vaul",
      "motion",
      "recharts",
      "driver.js",
      "react-zoom-pan-pinch",
      // Prebundle icon barrels — without this, named imports still fan out to
      // thousands of /node_modules/.../IconName.es.js requests and blank #root.
      "lucide-react",
      "@phosphor-icons/react",
    ],
  },
  build: {
    outDir: path.resolve(rootDir, "dist-playground"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(rootDir, "playground/index.html"),
    },
  },
});
