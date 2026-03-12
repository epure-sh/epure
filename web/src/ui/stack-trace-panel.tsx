import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { EventDetail } from "../lib/api";
import { cn } from "../lib/cn";
import { OccurrencePicker } from "./occurrence-picker";
import { SourceCodeBlock, type SourceCodeLine } from "./source-code-block";

interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  in_app?: boolean;
}

interface UniqueFrame {
  frame: StackFrame;
  key: string;
}

interface IndexedFrame {
  unique: UniqueFrame;
  globalIndex: number;
}

type StackListItem =
  | { type: "frame"; entry: IndexedFrame }
  | { type: "vendor-run"; runId: string; frames: IndexedFrame[] };

const ROW_PAD = "px-3 py-2.5";
const CHEVRON_CLASS = "h-3.5 w-3.5";
const INDEX_CLASS = "w-4 shrink-0 pt-0.5 text-right text-2xs tabular-nums text-ink-muted";

function asStackFrames(value: unknown): StackFrame[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as StackFrame[];
}

function frameKey(frame: StackFrame): string {
  return [
    frame.function ?? "",
    frame.filename ?? "",
    frame.lineno ?? "",
    frame.colno ?? "",
  ].join("|");
}

function dedupeStackFrames(frames: StackFrame[]): UniqueFrame[] {
  const seen = new Set<string>();
  const unique: UniqueFrame[] = [];

  for (const frame of frames) {
    const key = frameKey(frame);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({ frame, key });
  }

  return unique;
}

function isVendorFrame(frame: StackFrame): boolean {
  if (frame.in_app === false) {
    return true;
  }
  const filename = (frame.filename ?? "").toLowerCase();
  return (
    filename.includes("node_modules") ||
    filename.includes("webpack") ||
    filename.includes("vite")
  );
}

function hasSourceContext(frame: StackFrame): boolean {
  return Boolean(
    frame.context_line?.trim() ||
      (frame.pre_context && frame.pre_context.length > 0) ||
      (frame.post_context && frame.post_context.length > 0),
  );
}

function findCulpritIndex(uniqueFrames: UniqueFrame[]): number | null {
  for (let index = uniqueFrames.length - 1; index >= 0; index -= 1) {
    const frame = uniqueFrames[index].frame;
    if (!isVendorFrame(frame) && hasSourceContext(frame)) {
      return index;
    }
  }

  for (let index = uniqueFrames.length - 1; index >= 0; index -= 1) {
    if (!isVendorFrame(uniqueFrames[index].frame)) {
      return index;
    }
  }

  return uniqueFrames.length > 0 ? 0 : null;
}

function buildStackList(uniqueFrames: UniqueFrame[]): StackListItem[] {
  const items: StackListItem[] = [];
  let index = 0;

  while (index < uniqueFrames.length) {
    const unique = uniqueFrames[index];
    if (!isVendorFrame(unique.frame)) {
      items.push({
        type: "frame",
        entry: { unique, globalIndex: index },
      });
      index += 1;
      continue;
    }

    const run: IndexedFrame[] = [];
    while (index < uniqueFrames.length && isVendorFrame(uniqueFrames[index].frame)) {
      run.push({ unique: uniqueFrames[index], globalIndex: index });
      index += 1;
    }

    if (run.length >= 2) {
      items.push({
        type: "vendor-run",
        runId: run.map((entry) => entry.unique.key).join("|"),
        frames: run,
      });
    } else if (run.length === 1) {
      items.push({ type: "frame", entry: run[0] });
    }
  }

  return items;
}

function vendorRunIds(stackList: StackListItem[]): string[] {
  return stackList
    .filter((item): item is Extract<StackListItem, { type: "vendor-run" }> => item.type === "vendor-run")
    .map((item) => item.runId);
}

function vendorRunForFrame(stackList: StackListItem[], globalIndex: number): string | null {
  for (const item of stackList) {
    if (item.type !== "vendor-run") {
      continue;
    }
    if (item.frames.some((entry) => entry.globalIndex === globalIndex)) {
      return item.runId;
    }
  }
  return null;
}

function exceptionFromEvent(event: EventDetail | null): { type: string; message: string } | null {
  if (!event) {
    return null;
  }
  const exception = event.payload_json?.exception as
    | { values?: Array<{ type?: string; value?: string }> }
    | undefined;
  const first = exception?.values?.[0];
  if (first?.type && first?.value) {
    return { type: first.type, message: first.value };
  }
  return null;
}

function frameSourceLines(frame: StackFrame): SourceCodeLine[] {
  const lines: SourceCodeLine[] = [];
  const lineno = frame.lineno ?? 1;
  const pre = frame.pre_context ?? [];
  const post = frame.post_context ?? [];

  pre.forEach((text, index) => {
    lines.push({
      number: lineno - pre.length + index,
      text,
    });
  });

  if (frame.context_line) {
    lines.push({
      number: lineno,
      text: frame.context_line,
      fault: true,
    });
  }

  post.forEach((text, index) => {
    lines.push({
      number: lineno + index + 1,
      text,
    });
  });

  if (lines.length === 0) {
    const fn = frame.function ?? "<anonymous>";
    lines.push({
      number: frame.lineno ?? 1,
      text: `${fn}()`,
      fault: true,
    });
  }

  return lines;
}

function shortFilename(filename?: string): string {
  return (filename ?? "?")
    .replace(/^webpack:\/\/\.\//, "")
    .replace(/^app:\/\//, "");
}

function frameBasename(filename?: string): string {
  const short = shortFilename(filename);
  const parts = short.split("/");
  return parts[parts.length - 1] || short;
}

function frameDirectory(filename?: string): string | null {
  const short = shortFilename(filename);
  const base = frameBasename(filename);
  if (short === base) {
    return null;
  }
  const dir = short.slice(0, short.length - base.length).replace(/\/$/, "");
  return dir || null;
}

function frameLocationLabel(frame: StackFrame): string {
  const base = frameBasename(frame.filename);
  if (frame.lineno != null) {
    return `${base}:${frame.lineno}${frame.colno != null ? `:${frame.colno}` : ""}`;
  }
  return base;
}

function frameContextPreview(frame: StackFrame): string | null {
  const line = frame.context_line?.trim();
  return line || null;
}

function formatFrameCopy(frame: StackFrame): string {
  const fn = frame.function ?? "<anonymous>";
  const file = shortFilename(frame.filename);
  const line = frame.lineno != null ? `:${frame.lineno}` : "";
  const col = frame.colno != null ? `:${frame.colno}` : "";
  const context = frame.context_line?.trim();
  return context
    ? `${fn} at ${file}${line}${col}\n${context}`
    : `${fn} at ${file}${line}${col}`;
}

function inAppFrameIndices(uniqueFrames: UniqueFrame[]): number[] {
  return uniqueFrames
    .map((entry, index) => ({ index, vendor: isVendorFrame(entry.frame) }))
    .filter((entry) => !entry.vendor)
    .map((entry) => entry.index);
}

function StackToolbarButton({
  children,
  onClick,
  disabled,
  emphasis,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-2xs focus-ring disabled:pointer-events-none disabled:text-ink-muted disabled:no-underline",
        emphasis
          ? "font-medium text-semantic-danger hover:underline"
          : "text-accent hover:underline",
        disabled && "no-underline",
      )}
    >
      {children}
    </button>
  );
}

function CallStackRow({
  frame,
  index,
  expanded,
  vendor,
  nested,
  isCulprit,
  rowRef,
  onToggle,
}: {
  frame: StackFrame;
  index: number;
  expanded: boolean;
  vendor: boolean;
  nested?: boolean;
  isCulprit?: boolean;
  rowRef?: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
}) {
  const preview = !expanded ? frameContextPreview(frame) : null;
  const directory = frameDirectory(frame.filename);

  return (
    <div
      ref={rowRef}
      className={cn(
        "epure-call-stack-entry",
        isCulprit && "border-l-2 border-l-semantic-danger bg-semantic-danger/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "epure-call-stack-row flex w-full items-start gap-2.5 text-left font-mono transition-colors duration-fast focus-ring",
          ROW_PAD,
          nested && "pl-8",
          expanded
            ? "text-ink"
            : "text-ink-muted hover:bg-state-hover hover:text-ink",
          vendor && !expanded && "opacity-70",
          isCulprit && !expanded && "hover:bg-semantic-danger/5",
        )}
      >
        <span className="mt-0.5 w-3.5 shrink-0 text-ink-muted">
          {expanded ? (
            <ChevronDown className={CHEVRON_CLASS} aria-hidden />
          ) : (
            <ChevronRight className={CHEVRON_CLASS} aria-hidden />
          )}
        </span>
        <span className={INDEX_CLASS}>{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("text-xs", isCulprit ? "font-semibold text-ink" : "font-medium text-ink")}>
              {frame.function ?? "<anonymous>"}()
            </span>
            {isCulprit ? (
              <span className="rounded-sm bg-semantic-danger/10 px-1 py-px font-mono text-2xs font-medium uppercase tracking-wide text-semantic-danger">
                Suspect
              </span>
            ) : null}
            {vendor ? (
              <span className="font-mono text-2xs uppercase tracking-wide text-ink-muted/80">vendor</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-2xs leading-snug text-ink-muted">
            {directory ? <span className="text-ink-muted/70">{directory}/</span> : null}
            <span className="text-ink-muted">{frameLocationLabel(frame)}</span>
          </span>
          {preview ? (
            <span className="mt-1 block truncate font-mono text-2xs text-ink-muted/90">{preview}</span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <SourceCodeBlock
          filename={frame.filename ?? "unknown"}
          functionName={frame.function}
          lineno={frame.lineno}
          colno={frame.colno}
          lines={frameSourceLines(frame)}
          showHeader
          density="compact"
          copyValue={formatFrameCopy(frame)}
          className="epure-source-code-block--inline mx-3 mb-3 rounded-md border border-border"
        />
      ) : null}
    </div>
  );
}

function VendorRunToggle({
  count,
  expanded,
  onClick,
}: {
  count: number;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        "epure-call-stack-vendor-toggle flex w-full items-center gap-2.5 text-left font-mono text-xs text-ink-muted transition-colors duration-fast hover:bg-state-hover hover:text-ink focus-ring",
        ROW_PAD,
      )}
    >
      <span className="mt-0.5 w-3.5 shrink-0 text-ink-muted">
        {expanded ? (
          <ChevronDown className={CHEVRON_CLASS} aria-hidden />
        ) : (
          <ChevronRight className={CHEVRON_CLASS} aria-hidden />
        )}
      </span>
      <span className={INDEX_CLASS} aria-hidden>···</span>
      <span className="min-w-0 flex-1 leading-snug">
        {expanded ? "Hide" : "Show"} {count} vendor frame{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

export interface StackTracePanelProps {
  events: EventDetail[];
  selectedEventId: string | null;
  selectedEvent?: EventDetail | null;
  onSelectEvent: (id: string, event?: EventDetail) => void;
  showOccurrencePicker?: boolean;
  /** @deprecated Stack lives on its own tab; kept for API compatibility */
  embedded?: boolean;
  onViewGrouping?: () => void;
}

export function StackTracePanel({
  events,
  selectedEventId,
  selectedEvent: selectedEventProp,
  onSelectEvent,
  showOccurrencePicker = true,
}: StackTracePanelProps) {
  const [expandedFrames, setExpandedFrames] = useState<Set<number>>(() => new Set());
  const [expandedVendorRuns, setExpandedVendorRuns] = useState<Record<string, boolean>>({});
  const culpritRef = useRef<HTMLDivElement>(null);

  const selectedEvent =
    selectedEventProp ??
    events.find((event) => event.id === selectedEventId) ??
    events[0] ??
    null;
  const frames = asStackFrames(selectedEvent?.stack_frames);
  const exception = exceptionFromEvent(selectedEvent);

  const uniqueFrames = useMemo(() => dedupeStackFrames(frames), [frames]);
  const stackList = useMemo(() => buildStackList(uniqueFrames), [uniqueFrames]);
  const vendorRunIdList = useMemo(() => vendorRunIds(stackList), [stackList]);
  const culpritIndex = useMemo(() => findCulpritIndex(uniqueFrames), [uniqueFrames]);
  const inAppIndices = useMemo(() => inAppFrameIndices(uniqueFrames), [uniqueFrames]);

  const isFrameExpanded = (index: number) => expandedFrames.has(index);
  const isVendorRunExpanded = (runId: string) => expandedVendorRuns[runId] ?? false;

  const allFramesExpanded =
    uniqueFrames.length > 0 && uniqueFrames.every((_, index) => expandedFrames.has(index));

  const allVendorRunsExpanded =
    vendorRunIdList.length === 0 ||
    vendorRunIdList.every((runId) => expandedVendorRuns[runId]);

  const allExpanded = allFramesExpanded && allVendorRunsExpanded;

  const noneExpanded =
    expandedFrames.size === 0 &&
    vendorRunIdList.every((runId) => !expandedVendorRuns[runId]);

  const hasInAppFrames = inAppIndices.length > 0;

  useEffect(() => {
    setExpandedFrames(new Set(uniqueFrames.map((_, index) => index)));
    setExpandedVendorRuns(
      Object.fromEntries(vendorRunIdList.map((runId) => [runId, true])),
    );
  }, [selectedEvent?.id, uniqueFrames.length, vendorRunIdList.join("|")]);

  useEffect(() => {
    if (culpritIndex == null || !culpritRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      culpritRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [culpritIndex, selectedEvent?.id]);

  const revealVendorRun = (index: number) => {
    const runId = vendorRunForFrame(stackList, index);
    if (runId && !isVendorRunExpanded(runId)) {
      setExpandedVendorRuns((current) => ({ ...current, [runId]: true }));
    }
  };

  const toggleFrame = (index: number) => {
    revealVendorRun(index);
    setExpandedFrames((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFrames(new Set(uniqueFrames.map((_, index) => index)));
    setExpandedVendorRuns(Object.fromEntries(vendorRunIdList.map((runId) => [runId, true])));
  };

  const collapseAll = () => {
    setExpandedFrames(new Set());
    setExpandedVendorRuns({});
  };

  const expandInApp = () => {
    setExpandedFrames(new Set(inAppIndices));
    setExpandedVendorRuns({});
  };

  const focusCulprit = () => {
    if (culpritIndex == null) {
      return;
    }
    revealVendorRun(culpritIndex);
    setExpandedFrames(new Set([culpritIndex]));
    requestAnimationFrame(() => {
      culpritRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  if (!selectedEvent) {
    return (
      <div className="px-4 py-4">
        <div className="epure-inset-well overflow-hidden px-3 py-6 text-center font-mono text-xs text-ink-muted">
          Select an issue to inspect the stack.
        </div>
      </div>
    );
  }

  const culpritFrame = culpritIndex != null ? uniqueFrames[culpritIndex]?.frame : null;

  return (
    <div className="epure-stack-trace flex min-h-0 flex-1 flex-col">
      {showOccurrencePicker ? (
        <div className="flex shrink-0 items-center border-b border-border px-4 py-2 md:px-5">
          <OccurrencePicker
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={onSelectEvent}
          />
        </div>
      ) : null}

      <div className="space-y-4 px-4 py-4 md:px-5">
        <div className="epure-stack-trace-exception epure-inset-well overflow-hidden px-4 py-3">
          {exception ? (
            <>
              <p className="font-mono text-sm font-semibold text-semantic-danger">{exception.type}</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-ink">{exception.message}</p>
              {culpritFrame ? (
                <p className="mt-2 font-mono text-2xs text-ink-muted">
                  Likely origin:{" "}
                  <span className="text-ink">
                    {culpritFrame.function ?? "<anonymous>"}() in {frameLocationLabel(culpritFrame)}
                  </span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-mono text-xs text-ink-muted">No exception details captured.</p>
          )}
        </div>

        {uniqueFrames.length > 0 ? (
          <div className="epure-call-stack overflow-hidden rounded-md border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-3 py-2">
              <p className="text-xs text-ink-muted">
                {uniqueFrames.length} frame{uniqueFrames.length === 1 ? "" : "s"}
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {culpritIndex != null ? (
                  <>
                    <StackToolbarButton onClick={focusCulprit} emphasis>
                      Suspect
                    </StackToolbarButton>
                    <span className="text-2xs text-ink-muted/50" aria-hidden>·</span>
                  </>
                ) : null}
                <StackToolbarButton onClick={expandInApp} disabled={!hasInAppFrames}>
                  In-app
                </StackToolbarButton>
                <span className="text-2xs text-ink-muted/50" aria-hidden>·</span>
                <StackToolbarButton onClick={expandAll} disabled={allExpanded}>
                  Expand all
                </StackToolbarButton>
                <span className="text-2xs text-ink-muted/50" aria-hidden>·</span>
                <StackToolbarButton onClick={collapseAll} disabled={noneExpanded}>
                  Collapse all
                </StackToolbarButton>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {stackList.map((item) => {
                if (item.type === "frame") {
                  const { frame } = item.entry.unique;
                  const globalIndex = item.entry.globalIndex;
                  return (
                    <CallStackRow
                      key={item.entry.unique.key}
                      frame={frame}
                      index={globalIndex}
                      vendor={isVendorFrame(frame)}
                      isCulprit={globalIndex === culpritIndex}
                      rowRef={globalIndex === culpritIndex ? culpritRef : undefined}
                      expanded={isFrameExpanded(globalIndex)}
                      onToggle={() => toggleFrame(globalIndex)}
                    />
                  );
                }

                const vendorExpanded = isVendorRunExpanded(item.runId);
                return (
                  <div key={item.runId} className="epure-call-stack-vendor-run divide-y divide-border/60">
                    <VendorRunToggle
                      count={item.frames.length}
                      expanded={vendorExpanded}
                      onClick={() =>
                        setExpandedVendorRuns((current) => ({
                          ...current,
                          [item.runId]: !vendorExpanded,
                        }))
                      }
                    />
                    {vendorExpanded
                      ? item.frames.map((entry) => (
                          <CallStackRow
                            key={entry.unique.key}
                            frame={entry.unique.frame}
                            index={entry.globalIndex}
                            vendor
                            nested
                            isCulprit={entry.globalIndex === culpritIndex}
                            rowRef={entry.globalIndex === culpritIndex ? culpritRef : undefined}
                            expanded={isFrameExpanded(entry.globalIndex)}
                            onToggle={() => toggleFrame(entry.globalIndex)}
                          />
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="epure-inset-well px-3 py-6 text-center font-mono text-xs text-ink-muted">
            No stack frames captured for this occurrence.
          </div>
        )}
      </div>
    </div>
  );
}
