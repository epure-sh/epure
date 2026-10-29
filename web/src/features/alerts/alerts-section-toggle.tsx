import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/cn";

export type AlertsSection = "history" | "configure";

export interface AlertsSectionToggleProps {
  value: AlertsSection;
  onChange: (value: AlertsSection) => void;
  className?: string;
}

export interface AlertsSectionCounts {
  rules?: number;
  history?: number;
}

function formatCount(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

/** Inbox | Rules — Radix `ToggleGroup`, toolbar density (design system). */
export function AlertsSectionToggle({
  value,
  onChange,
  counts,
  className,
}: AlertsSectionToggleProps & { counts?: AlertsSectionCounts }) {
  const segment = value === "configure" ? "rules" : "history";

  return (
    <ToggleGroup
      type="single"
      density="toolbar"
      value={segment}
      aria-label="Alerts view"
      className={cn("shrink-0", className)}
      onValueChange={(next) => {
        if (next === "history") {
          onChange("history");
        } else if (next === "rules") {
          onChange("configure");
        }
      }}
    >
      <ToggleGroupItem
        value="history"
        size="toolbar"
        aria-label={
          counts?.history != null ? `Inbox, ${counts.history} needing action` : "Inbox"
        }
        className="min-w-[5.25rem]"
      >
        <span>Inbox</span>
        {counts?.history != null ? (
          <Badge
            variant={segment === "history" && counts.history > 0 ? "accent" : "neutral"}
            size="sm"
            className="h-4 px-1 font-mono text-[10px] leading-none tabular-nums"
          >
            {formatCount(counts.history)}
          </Badge>
        ) : null}
      </ToggleGroupItem>

      <ToggleGroupItem
        value="rules"
        size="toolbar"
        aria-label={counts?.rules != null ? `Rules, ${counts.rules} total` : "Rules"}
        className="min-w-[4.75rem]"
      >
        <span>Rules</span>
        {counts?.rules != null ? (
          <Badge
            variant={segment === "rules" ? "accent" : "neutral"}
            size="sm"
            className="h-4 px-1 font-mono text-[10px] leading-none tabular-nums"
          >
            {counts.rules}
          </Badge>
        ) : null}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
