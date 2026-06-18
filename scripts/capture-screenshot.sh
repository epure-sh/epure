#!/usr/bin/env bash
# Capture README hero screenshot from a running Epure stack.
# Requires: Node 22+, Playwright chromium (`npx playwright install chromium`)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/.github}"
PROJECT_ID="${EPURE_PROJECT_ID:-550e8400-e29b-41d4-a716-446655440000}"
ISSUE_ID="${EPURE_ISSUE_ID:-48fd683e-bfe1-4275-80f2-f2a95e570b8c}"
BASE_URL="${EPURE_BASE_URL:-http://localhost:8080}"

mkdir -p "$OUT_DIR"

node <<NODE
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const outDir = process.argv[1];
const baseUrl = process.argv[2];
const projectId = process.argv[3];
const issueId = process.argv[4];
const url = \`\${baseUrl}/p/\${projectId}/issues?issue=\${issueId}\`;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

await page.goto(\`\${baseUrl}/login\`, { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.fill('input[type="email"], input[name="email"]', "dev@epure.local");
  await page.fill('input[type="password"], input[name="password"]', "devpassword");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
}

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".epure-app-shell", { timeout: 15000 });
await page.waitForTimeout(500);

const png = join(outDir, "issues-list.png");
await page.locator(".epure-app-shell").first().screenshot({ path: png, type: "png" });
await browser.close();
console.log("saved", png);
NODE "$OUT_DIR" "$BASE_URL" "$PROJECT_ID" "$ISSUE_ID"

if command -v python3 >/dev/null; then
  python3 - <<'PY'
from pathlib import Path
try:
    from PIL import Image
    root = Path("$OUT_DIR")
    img = Image.open(root / "issues-list.png")
    img.save(root / "issues-list.webp", "WEBP", quality=88)
    social = img.resize((1200, 630))
    social.save(root / "social-preview.png", "PNG")
    print("webp + social-preview ok")
except ImportError:
    print("install pillow for webp conversion: pip install pillow")
PY
fi
