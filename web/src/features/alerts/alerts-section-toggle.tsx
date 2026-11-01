import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/** Inbox | Rules — page-title tabs (larger than toolbar density). */
export function AlertsSectionToggle({
  value,
  onChange,
  counts,
  className,
}: AlertsSectionToggleProps & { counts?: AlertsSectionCounts }) {
  const segment = value === "configure" ? "rules" : "history";

  return (
    <Tabs
      value={segment}
      onValueChange={(next) => {
        if (next === "history") {
          onChange("history");
        } else if (next === "rules") {
          onChange("configure");
        }
      }}
      className={cn("shrink-0", className)}
    >
      <TabsList
        aria-label="Alerts view"
        className="h-10 gap-1 rounded-[calc(var(--radius-md)+4px)] !bg-surface p-1 ring-1 ring-border !shadow-none"
      >
        <TabsTrigger
          value="history"
          aria-label={
            counts?.history != null ? `Inbox, ${counts.history} needing action` : "Inbox"
          }
          className="h-8 min-w-[6.5rem] gap-2 !rounded-[var(--radius-md)] px-3.5 text-sm font-medium text-fg-muted data-[state=active]:!bg-bg-subtle data-[state=active]:text-fg-primary data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-border"
        >
          <span>Inbox</span>
          {counts?.history != null ? (
            <Badge
              variant={segment === "history" && counts.history > 0 ? "accent" : "neutral"}
              size="sm"
              className="h-5 px-1.5 font-mono text-[11px] leading-none tabular-nums"
            >
              {formatCount(counts.history)}
            </Badge>
          ) : null}
        </TabsTrigger>

        <TabsTrigger
          value="rules"
          aria-label={counts?.rules != null ? `Rules, ${counts.rules} total` : "Rules"}
          className="h-8 min-w-[6rem] gap-2 !rounded-[var(--radius-md)] px-3.5 text-sm font-medium text-fg-muted data-[state=active]:!bg-bg-subtle data-[state=active]:text-fg-primary data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-border"
        >
          <span>Rules</span>
          {counts?.rules != null ? (
            <Badge
              variant={segment === "rules" ? "accent" : "neutral"}
              size="sm"
              className="h-5 px-1.5 font-mono text-[11px] leading-none tabular-nums"
            >
              {counts.rules}
            </Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
