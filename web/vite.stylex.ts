import path from "node:path";
import { fileURLToPath } from "node:url";
import stylex from "@stylexjs/unplugin";
import type { Plugin } from "vite";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const orbitRoot = path.resolve(webRoot, "../packages/orbit");

type StylexViteOptions = NonNullable<Parameters<typeof stylex.vite>[0]> & {
  /** Documented on unplugin; omitted from some published type versions. */
  externalPackages?: string[];
};

/**
 * StyleX Vite plugin shared by app + playground.
 * Compiles Orbit Box/Text tokens and app StyleX usage; LightningCSS polyfills light-dark().
 */
export function stylexPlugin(): Plugin {
  const options: StylexViteOptions = {
    // Layers lose to Tailwind’s unlayered preflight `* { padding: 0 }` — padding
    // (and other StyleX longhands) never applied. Unlayered StyleX wins on
    // class specificity instead.
    useCSSLayers: false,
    runtimeInjection: false,
    treeshakeCompensation: true,
    // css-only avoids virtual:stylex:runtime (known to wedge Vite dep optimize under load).
    // CSS still served at /virtual:stylex.css via middleware + HTML injection.
    devMode: "css-only",
    // Force-transform the vendored package (file: link may not auto-discover).
    externalPackages: ["@polar-sh/orbit"],
    unstable_moduleResolution: {
      type: "commonJS",
      rootDir: webRoot,
    },
  };
  return stylex.vite(options) as Plugin;
}

export const orbitPackageRoot = orbitRoot;
