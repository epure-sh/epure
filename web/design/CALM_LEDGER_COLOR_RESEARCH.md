# Calm Ledger color — research archive

**Status:** **Indigo selected** (2026-09-14) — production default  
**Scope:** Historical color-variant exploration; shipped product uses **one** theme: `calm-ledger` (Indigo)

---

## Decision

**Indigo (`calm-ledger`)** is the only production style. Twelve color variants and two alternate geometry themes (Quiet Ledger, Calm Dense) were explored during design iteration and removed after selection.

| Property | Value |
|----------|-------|
| Theme id | `calm-ledger` |
| Display name | Indigo / Calm Ledger |
| Accent | `#5a52e8` (light) · `#8b84f0` (dark) |
| Geometry | Pill buttons, card stats, airy issue rows, underline tabs, overlay master-detail |
| Files | `web/design/themes/calm-ledger.css` + shared `tokens.css` |

**Rationale (unchanged):** Balances BRAND “Plausible for Sentry” positioning with P2 B2B trust — cool neutrals, muted indigo accent, calm after a bad deploy.

---

## Archived variant exploration

The following were evaluated and **not** shipped. Kept here for context only.

| Group | Variants considered | Register |
|-------|---------------------|----------|
| Trust | Slate, Ocean, Ink | Enterprise / regulated |
| Warmth | Sage, Violet, Rose, Moss | OSS / indie |
| Focus | Graphite, Frost | Neutral instrument |
| Alert | Amber, Coral | Triage energy |

Geometry alternates **Quiet Ledger** (editorial split) and **Calm Dense** (mono compact) were also evaluated and retired.

---

## Design principles (still apply)

1. **Neutrals carry ~90% of pixels** — accent carries structure; semantics carry exception state.
2. **Danger earns its keep** — unresolved issues stay neutral; red is for regressions and blocking states.
3. **No hex in JSX** — palette lives in `calm-ledger.css` and `tokens.css` only.
4. **Legacy `localStorage` keys** — any stored variant or geometry id migrates to `calm-ledger` via `style-theme.ts`.

---

## Implementation

- **Selector:** `data-style="calm-ledger"` on `<html>` (set by `initStyleTheme()`)
- **Component hooks:** `.epure-*` classes in `calm-ledger.css`
- **No style switcher** — single theme in app
