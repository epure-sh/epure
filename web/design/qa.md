# UI QA checklist

Ship a product UI slice only if all pass:

- [ ] `--danger` only for live exceptions — not decorative chrome
- [ ] Palette: paper canvas (`#f4f4f2`), indigo accent (`#4338ca`), **one chroma** — `--signal` aliases `--accent`. Unread is **not** green
- [ ] Unread vs selected: unread = weight + small indigo cue (dot/2px edge), **no full-row wash**; selected = `--accent-muted` wash; both = wash + unread mark
- [ ] Accent < ~10% of pixels on issue list — do not flood rows with indigo
- [ ] DSN, stack paths, hashes use `font-mono` only
- [ ] Button radius = `rounded-md` / 8px — **no 9999px pills** on buttons, badges, chips, or checkboxes. Edit `button.tsx` / theme, not per-screen
- [ ] Ghost buttons have **no** forced border
- [ ] Default control height `h-8` (buttons, inputs, selects) unless `size="sm"`
- [ ] Filter chips 5–6px, not capsules
- [ ] Cards 12px, hairline only — no drop shadows on chrome
- [ ] Header on paper with 8% hairline; rail flat `--bg-subtle` with 2px inset accent (no gradient / 3px pill bar)
- [ ] Chrome titles 14–15px; list titles 13–14px; no display sizes in-app
- [ ] Tabular counts use slashed-zero (`font-mono-slash` or equivalent)
- [ ] Empty states: quiet type + one next action — **no** dashed frame, mascot, confetti, or celebratory copy
- [ ] Borders = 1px hairlines; **no** box-shadow on cards, popovers, dialogs, or dropdowns
- [ ] Focus = 1px accent border — no glow ring or focus shadow
- [ ] Dark mode on existing Epure dark tokens — not pure black swap (dark `--signal` still aliases `--accent`)
- [ ] No hex literals or `bg-[#…]` in `src/ui/`, `src/shell/`, `src/features/`
- [ ] Sans UI uses `tracking-ui` (-0.007em) where type is set explicitly
- [ ] No marketing.css / landing tokens in the product tree
