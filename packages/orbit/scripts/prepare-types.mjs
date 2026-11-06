import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Installed as a dependency of web, Orbit's own devDependencies (and often
// `tsc`) are absent. The committed dist declarations are what the web build
// typechecks against — only regenerate when this package has its own tsc.
// A global `tsc` is ignored: release runners can have a newer TypeScript that
// rejects this tsconfig and fails the image build.
if (!existsSync("node_modules/@types/react") || !existsSync("node_modules/.bin/tsc")) {
  process.exit(0);
}

const result = spawnSync("node_modules/.bin/tsc", ["-p", "tsconfig.declarations.json"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
