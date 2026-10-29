import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Orbit's committed dist/*.d.ts import @radix-ui/* (and friends). TypeScript
// resolves those from packages/orbit/, not from web/node_modules — so a clean
// `npm ci` in web alone leaves `tsc -b` unable to see Orbit props (children,
// checked, variant, …). Install Orbit's production deps locally when missing.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sentinel = join(root, "node_modules/@radix-ui/react-tabs");

if (existsSync(sentinel)) {
  process.exit(0);
}

// --ignore-scripts: we only need packages on disk for .d.ts resolution; the
// prepare hook would otherwise try to run `tsc` without Orbit's devDeps.
const result = spawnSync(
  "npm",
  ["ci", "--omit=dev", "--ignore-scripts"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
  },
);
process.exit(result.status ?? 1);
