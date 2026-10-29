import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventDetail } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { Box } from "@polar-sh/orbit/Box";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export interface OccurrencePickerProps {
  events: EventDetail[];
  selectedEventId: string | null;
  selectedEvent?: EventDetail | null;
  onSelectEvent: (id: string, event?: EventDetail) => void;
  onViewAll?: () => void;
  /** Show prev/next affordances beside the select (sticky bar). */
  showNav?: boolean;
  /**
   * `tab` — compact control matched to folder tab height, for the tab row.
   * `default` — full sticky-bar control.
   */
  density?: "default" | "tab";
  className?: string;
}

/** Menu / a11y line: name · email · when (e.g. `alex · alex@acme.com · 40m ago`). */
function formatOccurrenceMenuLabel(event: EventDetail): string {
  const when = formatRelativeTime(event.occurred_at);
  const email = event.user_email?.trim() || null;
  const userId = event.user_id?.trim() || null;
  const nameFromEmail = email?.includes("@") ? email.split("@")[0]! : null;
  const name = nameFromEmail || userId;

  const parts: string[] = [];
  if (name) {
    parts.push(name);
  }
  if (email && email !== name) {
    parts.push(email);
  }
  parts.push(when);
  return parts.join(" · ");
}

function formatOccurrenceLabel(event: EventDetail): string {
  return formatOccurrenceMenuLabel(event);
}

/** Ultra-short label for the tab-row control. */
function formatTabOccurrenceLabel(event: EventDetail): string {
  const email = event.user_email?.trim();
  if (email) {
    const short = email.includes("@") ? email.split("@")[0]! : email;
    return short.length > 18 ? `${short.slice(0, 16)}…` : short;
  }
  if (event.user_id) {
    const id = event.user_id;
    return id.length > 18 ? `${id.slice(0, 16)}…` : id;
  }
  return formatRelativeTime(event.occurred_at);
}

export function OccurrencePicker({
  events,
  selectedEventId,
  selectedEvent: selectedEventProp,
  onSelectEvent,
  showNav = false,
  density = "default",
  className,
}: OccurrencePickerProps) {
  const selectedId = selectedEventId ?? events[0]?.id ?? "";
  const selectedEvent =
    selectedEventProp ??
    events.find((event) => event.id === selectedId) ??
    events[0] ??
    null;
  const tabDensity = density === "tab";

  if (events.length === 0 || !selectedEvent) {
    return null;
  }

  const selectedIndex = events.findIndex((event) => event.id === selectedEvent.id);
  const hasPrevious = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < events.length - 1;

  const goPrevious = () => {
    if (!hasPrevious) return;
    const prev = events[selectedIndex - 1];
    onSelectEvent(prev.id, prev);
  };

  const goNext = () => {
    if (!hasNext) return;
    const next = events[selectedIndex + 1];
    onSelectEvent(next.id, next);
  };

  const triggerLabel = tabDensity
    ? formatTabOccurrenceLabel(selectedEvent)
    : formatOccurrenceLabel(selectedEvent);
  const triggerClassName = tabDensity
    ? "h-6 min-h-6 w-auto max-w-[9.5rem] gap-0.5 rounded-sm border-transparent bg-transparent px-1.5 font-mono text-[10px] text-fg-muted shadow-none hover:bg-surface-2 hover:text-fg-secondary [&>svg]:size-3 [&>svg]:opacity-50"
    : "h-control w-full max-w-md font-mono text-xs text-ink";

  const selectOrLabel =
    events.length === 1 ? (
      <Button
        variant={tabDensity ? "ghost" : "outline"}
        size={tabDensity ? "sm" : "default"}
        className={cn(triggerClassName, "cursor-default", !tabDensity && "hover:bg-surface")}
        disabled
        aria-label={`Occurrence: ${formatOccurrenceMenuLabel(selectedEvent)}`}
      >
        <Box as="span" overflow="hidden">
          {triggerLabel}
        </Box>
      </Button>
    ) : (
      <Select
        value={selectedId}
        onValueChange={(id) => {
          const event = events.find((row) => row.id === id);
          if (event) {
            onSelectEvent(id, event);
          }
        }}
      >
        <SelectTrigger
          size="sm"
          className={triggerClassName}
          aria-label={`Occurrence: ${formatOccurrenceMenuLabel(selectedEvent)}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <SelectValue placeholder="Select occurrence">{triggerLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="max-h-64 max-w-[min(100vw-2rem,22rem)]">
          {events.map((event) => (
            <SelectItem
              key={event.id}
              value={event.id}
              className="py-1.5 text-xs text-fg-secondary"
            >
              {formatOccurrenceMenuLabel(event)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  if (!showNav || events.length < 2) {
    return (
      <div className={cn(tabDensity ? "w-auto shrink-0" : "w-full", className)}>
        {selectOrLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        tabDensity ? "w-auto shrink-0 gap-1" : "w-full gap-1.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className={tabDensity ? "size-7 shrink-0" : undefined}
        onClick={goPrevious}
        disabled={!hasPrevious}
        aria-label="Previous occurrence"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <div className={cn("min-w-0", tabDensity ? "w-auto" : "flex-1")}>{selectOrLabel}</div>
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className={tabDensity ? "size-7 shrink-0" : undefined}
        onClick={goNext}
        disabled={!hasNext}
        aria-label="Next occurrence"
      >
        <ChevronRight className="size-3.5" />
      </Button>
      <span className="shrink-0 font-mono text-2xs tabular-nums text-fg-muted">
        {selectedIndex + 1}/{events.length}
      </span>
    </div>
  );
}
