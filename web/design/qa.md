# UI QA checklist

Ship a product UI slice only if all pass:

- [ ] `--danger` only for live exceptions — not decorative chrome
- [ ] Palette: indigo accent, cool instrument canvas, green `--signal` for unread
- [ ] DSN, stack paths, hashes use `font-mono` only
- [ ] Button radius = `rounded-md` (shadcn new-york) — edit `button.tsx`, not per-screen
- [ ] Default control height `h-8` (buttons, inputs, selects) unless `size="sm"`
- [ ] Accent < ~10% of pixels on issue list
- [ ] Tabular counts use slashed-zero (`font-mono-slash` or equivalent)
- [ ] Empty states: no mascot, confetti, or celebratory copy
- [ ] Borders = 1px hairlines; **no** box-shadow on cards, popovers, dialogs, or dropdowns
- [ ] Focus = 1px accent border — no glow ring or focus shadow
- [ ] Dark mode on existing Epure dark tokens — not pure black swap
- [ ] No hex literals or `bg-[#…]` in `src/ui/`, `src/shell/`, `src/features/`
- [ ] Sans UI uses `tracking-ui` (-0.007em) where type is set explicitly
- [ ] No marketing.css / landing tokens in the product tree
