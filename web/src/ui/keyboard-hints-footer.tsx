import { Kbd } from "./kbd";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["j", "k"], label: "Navigate" },
  { keys: ["e"], label: "Resolve" },
  { keys: ["i"], label: "Ignore" },
  { keys: ["x"], label: "Select" },
  { keys: ["/"], label: "Search" },
  { keys: ["⌘⇧C"], label: "Copy for AI" },
];

export function KeyboardHintsFooter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="epure-keyboard-hints inline-flex h-8 w-8 items-center justify-center rounded-md text-sm tracking-ui text-ink-muted transition-colors hover:bg-bg-subtle/60 hover:text-ink focus-ring"
          aria-label="Keyboard shortcuts"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-56 p-3 shadow-none">
        <p className="mb-2 text-xs font-medium tracking-ui text-ink">Shortcuts</p>
        <ul className="space-y-1.5">
          {SHORTCUTS.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 text-xs tracking-ui text-ink-muted"
            >
              <span>{row.label}</span>
              <span className="inline-flex items-center gap-0.5">
                {row.keys.map((key) => (
                  <Kbd key={key} keys={key} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
