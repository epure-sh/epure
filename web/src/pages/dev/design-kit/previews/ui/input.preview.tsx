import * as React from "react";
import { Input } from "@polar-sh/orbit/Input";
import { Search } from "@polar-sh/orbit/icons";
import { cn } from "@/lib/utils";
import {
  ComponentPlaygroundControls,
  useInputPlayground,
} from "../../component-playground-controls";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function InputPreview() {
  const [value, setValue] = React.useState("");
  const playground = useInputPlayground();

  const sizeClasses: Record<string, string> = {
    sm: "h-8 text-xs",
    md: "h-9 text-sm",
    lg: "h-11 text-base",
  };

  return (
    <PreviewBlock
      id="input"
      title="Input"
      description="Polar Orbit Input — single-line with optional slots and interactive controls."
      controls={
        <ComponentPlaygroundControls
          axes={playground.axes}
          flags={playground.flags}
        />
      }
    >
      <PreviewRow label="Live Interactive Input">
        <Input
          placeholder={
            playground.error
              ? "Invalid filter token syntax…"
              : playground.loading
                ? "Connecting to Edge ingest…"
                : "Type query token (e.g. is:unresolved)…"
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={playground.disabled}
          aria-invalid={playground.error ? true : undefined}
          preSlot={<Search className="h-4 w-4" />}
          className={cn(
            sizeClasses[playground.size] ?? "h-9 text-sm",
            playground.error && "border-semantic-danger focus-visible:ring-semantic-danger/30",
          )}
        />
      </PreviewRow>
      <PreviewRow label="Basic" className="mt-3">
        <Input
          placeholder="Enter your name"
          defaultValue="Production Cluster"
        />
      </PreviewRow>
      <PreviewRow label="Slots" className="mt-3">
        <Input
          placeholder="Search…"
          preSlot={<Search className="h-4 w-4" />}
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
