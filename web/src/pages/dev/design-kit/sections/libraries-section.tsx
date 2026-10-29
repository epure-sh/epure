import { PreviewBlock } from "../shared";

const STACK = [
  {
    lib: "Radix UI",
    role: "Primitives",
    note: "Dialog, Select, Tabs, Checkbox, Toggle Group, Tooltip, Popover, Dropdown — behavior + a11y. Personalized in @/components/ui via CVA + Calm Ledger tokens.",
  },
  {
    lib: "cmdk",
    role: "Command palette",
    note: "Command / CommandDialog. Do not hand-roll listbox filter for ⌘K.",
  },
  {
    lib: "Sonner",
    role: "Toasts",
    note: "toast.* via @/components/ui/sonner — themed Toaster, not a custom portal stack.",
  },
  {
    lib: "Vaul",
    role: "Mobile drawer",
    note: "Drawer* exports in sheet.tsx for pull-to-dismiss sheets. Desktop Sheet stays Radix Dialog.",
  },
  {
    lib: "Phosphor",
    role: "Icons",
    note: "@/components/ui/icon re-exports. Prefer weight=bold for chrome at 14–16px.",
  },
  {
    lib: "TanStack Table v9",
    role: "Data density",
    note: "Orbit DataTable (@/components/kit/data-table) — manual sort/pagination.",
  },
  {
    lib: "Recharts",
    role: "Charts",
    note: "telemetry-chart + sparklines wrap Recharts; tokens color the series.",
  },
  {
    lib: "tw-animate-css + CSS vars",
    role: "Motion",
    note: "Overlay enter/exit via animate-in. Durations/easings from design/tokens.css (--duration-*, --ease-*). motion package reserved for complex sequences — prefer tokens first.",
  },
] as const;

export function LibrariesSection() {
  return (
    <div id="libraries" className="scroll-mt-24 space-y-4">
      <PreviewBlock
        id="libraries-stack"
        title="Library-first stack"
        description="Personalize in the design-system layer; do not fork primitives libraries already solve. App screens compose @/components/ui + kit + src/ui only."
      >
        <ul className="divide-y divide-border-subtle rounded-control border border-border-subtle">
          {STACK.map((row) => (
            <li key={row.lib} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[8rem_6rem_1fr] sm:gap-3">
              <span className="text-xs font-medium text-fg-primary">{row.lib}</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-fg-muted">
                {row.role}
              </span>
              <span className="text-[11px] leading-relaxed text-fg-muted">{row.note}</span>
            </li>
          ))}
        </ul>
      </PreviewBlock>
    </div>
  );
}
