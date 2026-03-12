import type { EventDetail } from "../lib/api";
import { formatRelativeTime } from "../lib/format-time";
import { cn } from "../lib/cn";
import { Button } from "./button";
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
}

function formatOccurrenceLabel(event: EventDetail): string {
  const relative = formatRelativeTime(event.occurred_at);
  const user = event.user_email ?? event.user_id;
  if (user) {
    return `${relative} · ${user}`;
  }
  return relative;
}

function formatOccurrenceDetail(event: EventDetail): string {
  const parts = [formatOccurrenceLabel(event)];
  if (event.release) {
    parts.push(event.release);
  }
  if (event.environment) {
    parts.push(event.environment);
  }
  return parts.join(" · ");
}

const triggerClassName =
  "h-control w-full max-w-md font-mono text-xs text-ink";

export function OccurrencePicker({
  events,
  selectedEventId,
  selectedEvent: selectedEventProp,
  onSelectEvent,
}: OccurrencePickerProps) {
  const selectedId = selectedEventId ?? events[0]?.id ?? "";
  const selectedEvent =
    selectedEventProp ??
    events.find((event) => event.id === selectedId) ??
    events[0] ??
    null;

  if (events.length === 0 || !selectedEvent) {
    return null;
  }

  const triggerLabel = formatOccurrenceLabel(selectedEvent);

  if (events.length === 1) {
    return (
      <div className="epure-occurrence-picker w-full max-w-md">
        <Button
          variant="outline"
          size="default"
          className={cn(triggerClassName, "cursor-default hover:bg-surface")}
          disabled
          aria-label={`Occurrence: ${formatOccurrenceDetail(selectedEvent)}`}
        >
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="epure-occurrence-picker w-full max-w-md">
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
          className={triggerClassName}
          aria-label={`Occurrence: ${formatOccurrenceDetail(selectedEvent)}`}
        >
          <SelectValue placeholder="Select occurrence">{triggerLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-64 max-w-[min(100vw-2rem,24rem)]">
          {events.map((event) => (
            <SelectItem
              key={event.id}
              value={event.id}
              className="font-mono text-xs"
            >
              {formatOccurrenceDetail(event)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
