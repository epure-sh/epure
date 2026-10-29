import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Installed as a dependency of web, Orbit's own devDependencies (and often
// `tsc`) are absent. The committed dist declarations are what the web build
// typechecks against — only regenerate when a full Orbit checkout can.
if (!existsSync("node_modules/@types/react")) {
  process.exit(0);
}

const probe = spawnSync("tsc", ["--version"], { shell: true });
if (probe.status !== 0) {
  process.exit(0);
}

const result = spawnSync("tsc", ["-p", "tsconfig.declarations.json"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
