import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Installed as a dependency of web, dev types are not present. The committed
// dist declarations are what the web build typechecks against.
if (!existsSync("node_modules/@types/react")) {
  process.exit(0);
}

const result = spawnSync("tsc", ["-p", "tsconfig.declarations.json"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
