import { useEffect, useMemo, useState } from "react";
import type { EventDetail } from "../../lib/api";
import { fetchEvents } from "../../lib/api";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { diffEvents } from "./diff-utils";

function formatOccurrenceLabel(event: EventDetail): string {
  const when = new Date(event.occurred_at).toLocaleString();
  const release = event.release ? ` · ${event.release}` : "";
  return `${when}${release}`;
}

function DiffTable({
  leftLabel,
  rightLabel,
  left,
  right,
}: {
  leftLabel: string;
  rightLabel: string;
  left: EventDetail;
  right: EventDetail;
}) {
  const rows = diffEvents(left, right);

  if (rows.length === 0) {
    return (
      <p className="epure-inset-well rounded-lg border border-border bg-bg-subtle px-4 py-3 text-sm text-ink-muted">
        No differences between the selected items.
      </p>
    );
  }

  return (
    <div className="epure-card overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-1 border-b border-border bg-bg-subtle sm:grid-cols-2">
        <div className="border-b border-border px-4 py-2.5 sm:border-b-0 sm:border-r">
          <p className="epure-label text-xs font-medium text-ink-muted">A — Before</p>
          <p className="mt-0.5 font-mono text-xs text-ink">{leftLabel}</p>
        </div>
        <div className="px-4 py-2.5">
          <p className="epure-label text-xs font-medium text-ink-muted">B — After</p>
          <p className="mt-0.5 font-mono text-xs text-ink">{rightLabel}</p>
        </div>
      </div>
      <div className="max-h-80 overflow-auto">
        {rows.map((row) => (
          <div
            key={row.key}
            className="border-b border-border last:border-b-0"
          >
            <p className="border-b border-border bg-surface px-4 py-1.5 font-mono text-xs text-ink-muted">
              {row.key}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <p className="border-b border-border px-4 py-2 font-mono text-xs break-all text-semantic-danger sm:border-b-0 sm:border-r">
                {row.left || "—"}
              </p>
              <p className="px-4 py-2 font-mono text-xs break-all text-semantic-success">
                {row.right || "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type DiffMode = "occurrence" | "release";

export interface DiffPanelProps {
  issueId: string;
  mode: DiffMode;
  onModeChange: (mode: DiffMode) => void;
  events: EventDetail[];
  leftEventId: string | null;
  rightEventId: string | null;
  onRightEventChange: (id: string | null) => void;
  releases: string[];
  leftRelease: string | null;
  rightRelease: string | null;
  onLeftReleaseChange: (release: string) => void;
  onRightReleaseChange: (release: string) => void;
}

export function DiffPanel({
  issueId,
  mode,
  onModeChange,
  events,
  leftEventId,
  rightEventId,
  onRightEventChange,
  releases,
  leftRelease,
  rightRelease,
  onLeftReleaseChange,
  onRightReleaseChange,
}: DiffPanelProps) {
  const [releaseLeft, setReleaseLeft] = useState<EventDetail | null>(null);
  const [releaseRight, setReleaseRight] = useState<EventDetail | null>(null);

  const leftEvent = useMemo(
    () => events.find((event) => event.id === leftEventId) ?? events[0] ?? null,
    [events, leftEventId],
  );

  const rightEvent = useMemo(
    () => events.find((event) => event.id === rightEventId) ?? null,
    [events, rightEventId],
  );

  const compareCandidates = useMemo(
    () => events.filter((event) => event.id !== leftEvent?.id),
    [events, leftEvent?.id],
  );

  useEffect(() => {
    if (rightEventId && rightEventId === leftEvent?.id) {
      onRightEventChange(null);
    }
  }, [leftEvent?.id, onRightEventChange, rightEventId]);

  useEffect(() => {
    if (mode !== "release" || !leftRelease || !rightRelease) {
      setReleaseLeft(null);
      setReleaseRight(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetchEvents(issueId, { release: leftRelease, limit: 1 }),
      fetchEvents(issueId, { release: rightRelease, limit: 1 }),
    ])
      .then(([leftPage, rightPage]) => {
        if (cancelled) {
          return;
        }
        setReleaseLeft(leftPage.events[0] ?? null);
        setReleaseRight(rightPage.events[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setReleaseLeft(null);
          setReleaseRight(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [issueId, leftRelease, mode, rightRelease]);

  const occurrenceReady = Boolean(leftEvent && rightEvent);
  const releaseReady =
    mode === "release" && leftRelease && rightRelease && releaseLeft && releaseRight;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "occurrence" ? "primary" : "secondary"}
          size="toolbar"
          onClick={() => onModeChange("occurrence")}
        >
          Compare occurrences
        </Button>
        <ActionButton
          variant={mode === "release" ? "primary" : "secondary"}
          size="toolbar"
          onClick={() => onModeChange("release")}
          disabled={releases.length < 2}
          tooltip={
            releases.length < 2
              ? "Need events from at least two releases to compare"
              : undefined
          }
        >
          Compare releases
        </ActionButton>
      </div>

      {mode === "occurrence" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="epure-inset-well rounded-lg border border-border bg-bg-subtle p-3">
            <p className="epure-label mb-2 text-xs font-medium text-ink-muted">
              A — Baseline occurrence
            </p>
            <p className="font-mono text-xs text-ink">
              {leftEvent ? formatOccurrenceLabel(leftEvent) : "No occurrence selected"}
            </p>
          </div>
          <div className="epure-inset-well rounded-lg border border-border p-3">
            <p className="epure-label mb-2 text-xs font-medium text-ink-muted">
              B — Compare with
            </p>
            {compareCandidates.length === 0 ? (
              <p className="text-xs text-ink-muted">Need another occurrence to compare.</p>
            ) : (
              <Select
                value={rightEventId ?? undefined}
                onValueChange={(value) => onRightEventChange(value)}
              >
                <SelectTrigger className="h-control-sm w-full text-xs">
                  <SelectValue placeholder="Select an occurrence to compare" />
                </SelectTrigger>
                <SelectContent>
                  {compareCandidates.map((event) => (
                    <SelectItem key={event.id} value={event.id} className="font-mono text-xs">
                      {formatOccurrenceLabel(event)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      ) : null}

      {mode === "release" ? (
        releases.length < 2 ? (
          <p className="text-sm text-ink-muted">
            Need events from at least two releases to compare.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="epure-inset-well rounded-lg border border-border p-3">
              <p className="epure-label mb-2 text-xs font-medium text-ink-muted">
                A — Earlier release
              </p>
              <Select
                value={leftRelease ?? undefined}
                onValueChange={onLeftReleaseChange}
              >
                <SelectTrigger className="h-control-sm w-full text-xs">
                  <SelectValue placeholder="Select release" />
                </SelectTrigger>
                <SelectContent>
                  {releases.map((release) => (
                    <SelectItem key={release} value={release} className="font-mono text-xs">
                      {release}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="epure-inset-well rounded-lg border border-border p-3">
              <p className="epure-label mb-2 text-xs font-medium text-ink-muted">
                B — Later release
              </p>
              <Select
                value={rightRelease ?? undefined}
                onValueChange={onRightReleaseChange}
              >
                <SelectTrigger className="h-control-sm w-full text-xs">
                  <SelectValue placeholder="Select release" />
                </SelectTrigger>
                <SelectContent>
                  {releases.map((release) => (
                    <SelectItem key={release} value={release} className="font-mono text-xs">
                      {release}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      ) : null}

      {mode === "occurrence" && occurrenceReady && leftEvent && rightEvent ? (
        <DiffTable
          leftLabel={formatOccurrenceLabel(leftEvent)}
          rightLabel={formatOccurrenceLabel(rightEvent)}
          left={leftEvent}
          right={rightEvent}
        />
      ) : null}

      {mode === "occurrence" && leftEvent && !rightEvent ? (
        <p className="text-sm text-ink-muted">
          Pick a second occurrence above to see differences.
        </p>
      ) : null}

      {mode === "release" && releaseReady && releaseLeft && releaseRight ? (
        <DiffTable
          leftLabel={leftRelease ?? ""}
          rightLabel={rightRelease ?? ""}
          left={releaseLeft}
          right={releaseRight}
        />
      ) : null}

      {mode === "release" && leftRelease && rightRelease && !releaseLeft && !releaseRight ? (
        <p className="text-sm text-ink-muted">Loading release events…</p>
      ) : null}
    </div>
  );
}
