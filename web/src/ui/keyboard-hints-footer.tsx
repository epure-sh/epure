import { useState } from "react";
import { Button } from "./button";
import { Kbd } from "./kbd";

export function KeyboardHintsFooter() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="epure-keyboard-hints shrink-0 border-t border-border bg-bg-subtle px-4 py-1.5">
        <Button
          variant="ghost"
          className="h-6 w-6 px-0 text-xs text-ink-muted"
          onClick={() => setOpen(true)}
          aria-label="Keyboard shortcuts"
        >
          ?
        </Button>
      </div>
    );
  }

  return (
    <div className="epure-keyboard-hints shrink-0 border-t border-border bg-bg-subtle px-4 py-2 text-xs text-ink-muted">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-ink">Shortcuts</span>
        <Button variant="ghost" className="text-xs" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <Kbd keys="j" /> <Kbd keys="k" /> navigate · <Kbd keys="Alt+K" /> open
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Kbd keys="e" /> resolve · <Kbd keys="i" /> ignore
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Kbd keys="x" /> select · <Kbd keys="/" /> search · <Kbd keys="Esc" /> close
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Kbd keys="⌘⇧C" /> export
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Kbd keys="1" />–<Kbd keys="4" /> detail tabs
        </span>
      </div>
    </div>
  );
}
