// web/src/ui/components/keyboard-hints-footer.tsx
// Tier 2 Component: Keyboard Shortcuts Help Trigger & Popover

import { Box } from "@polar-sh/orbit/Box";
import { Kbd, Popover, PopoverContent, PopoverTrigger } from "../primitives";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["j", "k"], label: "Navigate" },
  { keys: ["e"], label: "Resolve" },
  { keys: ["i"], label: "Ignore" },
  { keys: ["x"], label: "Select" },
  { keys: ["/"], label: "Search" },
  { keys: ["⌘⇧C"], label: "Copy for agent" },
];

export function KeyboardHintsFooter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-tour="keyboard-hints"
          className="epure-keyboard-hints inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-transparent text-sm tracking-ui text-fg-muted transition-colors hover:bg-state-hover hover:text-fg-primary focus-ring"
          aria-label="Keyboard shortcuts"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-56 p-3 shadow-none">
        <p className="mb-2 text-xs font-medium tracking-ui text-ink">Shortcuts</p>
        <Box as="ul" flexDirection="column" rowGap="s">
          {SHORTCUTS.map((row) => (
            <Box
              as="li"
              alignItems="center"
              justifyContent="between"
              gap="m"
              key={row.label}
            >
              <Box as="span">{row.label}</Box>
              <Box as="span" alignItems="center" gap="xs">
                {row.keys.map((key) => (
                  <Kbd key={key} keys={key} />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </PopoverContent>
    </Popover>
  );
}
