## 2026-10-28T17:26:13Z
You are Worker R1 (Design Token & Depth System Foundation) for the Epure UI/UX refactor project.

Your assigned metadata working directory:
/Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/worker_r1/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read these documents before making changes:
- /Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/orchestrator_1/PROJECT.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/explorer_survey_1/handoff.md

Relevant design skills:
- /Users/amomo/Projets/kelson/apps/epure/.agents/skills/apple-design/SKILL.md
- /Users/amomo/Projets/kelson/apps/epure/.agents/skills/emil-design-eng/SKILL.md

Target project directory:
/Users/amomo/Projets/kelson/apps/epure/web

Files you exclusively own for editing:
- web/design/tokens.css
- web/design/themes/calm-ledger.css
- web/src/styles/tokens.css
- web/src/app.css
- web/index.html
- web/src/features/org/channels.tsx

Mission Tasks (Milestone R1):
1. In `web/design/tokens.css`:
   - Append motion easing curves (`--ease-out`, `--ease-in-out`, `--ease-drawer`), spring constants (`--spring-damping: 1.0`, `--spring-response: 0.35s`), and safe area variables (`--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right`).
2. In `web/design/themes/calm-ledger.css`:
   - Add specular rim highlight token (`--shadow-specular`) in both `:root, [data-style="calm-ledger"]` (light) and `[data-theme="dark"]` (dark).
   - Add brand tokens for Slack (`--channel-slack: #E01E5A;`) and Discord (`--channel-discord: #5865F2;`).
3. In `web/src/styles/tokens.css`:
   - Expose `--shadow-specular`, `--color-channel-slack`, and `--color-channel-discord` in `@theme inline`.
   - Add base layer resets to `html, body`: `touch-action: manipulation; -webkit-tap-highlight-color: transparent;`.
4. In `web/src/app.css`:
   - Upgrade button tactile feedback (`.btn-tactile:active { transform: scale(0.97); }`) with 100ms cubic-bezier transition.
   - Refine `.epure-surface-specular` to utilize `var(--shadow-specular)`.
5. In `web/index.html`:
   - Update viewport meta to include `viewport-fit=cover`.
6. In `web/src/features/org/channels.tsx`:
   - Replace arbitrary hex classes `text-[#E01E5A]` and `text-[#5865F2]` with semantic classes `text-channel-slack` and `text-channel-discord`.
7. Execute verification in `web/`:
   - Run `npm test` (all 109 tests must pass).
   - Run `npm run typecheck` (0 errors).
   - Run `npm run lint` (0 errors, 0 warnings).
   - Run `npm run build` (successful Vite build).

Deliverables:
- Write `changes.md` in `/Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/worker_r1/changes.md`.
- Write `handoff.md` in `/Users/amomo/Projets/kelson/apps/epure/.agents/teamwork/worker_r1/handoff.md`.
- Update `progress.md` with timestamps.
- When done, send a message to orchestrator with your summary and verification commands/results.
