import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { EventDetail } from "../lib/api";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import { OccurrencePicker } from "./occurrence-picker";
import { SourceCodeBlock, type SourceCodeLine } from "./source-code-block";
import { useToast } from "./toast-provider";

interface StackFrame {
  filename?: string;
  function?: string;
  module?: string;
  package?: string;
  symbol?: string;
  instruction_addr?: string;
  lineno?: number;
  colno?: number;
  context?: string;
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

function asStackFrames(value: unknown): StackFrame[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is StackFrame => Boolean(item && typeof item === "object"));
}

function frameKey(frame: StackFrame): string {
  if (!frame || typeof frame !== "object") return "";
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
    if (!frame || typeof frame !== "object") continue;
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
  if (!frame || typeof frame !== "object") return false;
  if (frame.in_app === false) {
    return true;
  }
  if (frame.in_app === true) {
    return false;
  }
  const filename = (frame.filename ?? "").toLowerCase();
  const module = frame.module ?? "";
  const pkg = frame.package ?? "";
  const fn = frame.function ?? "";

  if (
    filename.includes("node_modules") ||
    filename.includes("webpack") ||
    filename.includes("vite") ||
    filename.includes("next/dist") ||
    filename.includes(".cargo/registry") ||
    filename.includes("/rustc/") ||
    filename.includes("/site-packages/") ||
    filename.includes("/dist-packages/") ||
    filename.includes("/src/runtime/")
  ) {
    return true;
  }

  const frameworkPrefixes = [
    "java.",
    "javax.",
    "jdk.",
    "sun.",
    "org.springframework.",
    "org.apache.",
    "org.hibernate.",
    "com.zaxxer.hikari.",
    "kotlin.",
    "System.",
    "Microsoft.",
    "Newtonsoft.Json",
    "Npgsql",
    "Swashbuckle",
    "MediatR",
    "std::",
    "core::",
    "alloc::",
    "tokio::",
    "hyper::",
    "tower::",
    "actix_",
    "axum::",
    "django.",
    "flask.",
    "fastapi.",
    "starlette.",
    "celery.",
    "runtime.",
    "net/http.",
  ];

  for (const prefix of frameworkPrefixes) {
    if (module.startsWith(prefix) || pkg.startsWith(prefix) || fn.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

function hasSourceContext(frame: StackFrame): boolean {
  const line = (frame.context_line ?? frame.context)?.trim();
  return Boolean(
    line ||
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

function remapStackListIndices(list: StackListItem[], total: number): StackListItem[] {
  const toOriginal = (displayIndex: number) => total - 1 - displayIndex;

  return list.map((item) => {
    if (item.type === "frame") {
      return {
        type: "frame",
        entry: {
          ...item.entry,
          globalIndex: toOriginal(item.entry.globalIndex),
        },
      };
    }
    return {
      type: "vendor-run",
      runId: item.runId,
      frames: item.frames.map((entry) => ({
        ...entry,
        globalIndex: toOriginal(entry.globalIndex),
      })),
    };
  });
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

interface ExceptionInfo {
  type: string;
  message: string;
  mechanism: string | null;
  handled: boolean | null;
}

function exceptionFromEvent(event: EventDetail | null): ExceptionInfo | null {
  if (!event) {
    return null;
  }
  const exception = event.payload_json?.exception as
    | {
        values?: Array<{
          type?: string;
          value?: string;
          mechanism?: { type?: string; handled?: boolean };
        }>;
      }
    | undefined;
  const first = exception?.values?.[0];
  if (first?.type && first?.value) {
    return {
      type: first.type,
      message: first.value,
      mechanism: first.mechanism?.type ?? null,
      handled: first.mechanism?.handled ?? null,
    };
  }
  return null;
}

function frameLineColumn(frame: StackFrame): string {
  if (frame.lineno == null || frame.lineno <= 0) {
    return "";
  }
  const col = frame.colno != null && frame.colno > 0 ? `:${frame.colno}` : "";
  return `:${frame.lineno}${col}`;
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
  if (!filename) return "?";
  return filename
    .replace(/^webpack-internal:\/\/\/\(rsc\)\/\.\//, "")
    .replace(/^webpack-internal:\/\/\/\(ssr\)\/\.\//, "")
    .replace(/^webpack-internal:\/\/\/\(app-pages-browser\)\/\.\//, "")
    .replace(/^webpack-internal:\/\/\/\.\//, "")
    .replace(/^webpack-internal:\/\/\//, "")
    .replace(/^turbopack:\/\/\/\[project\]\//, "")
    .replace(/^turbopack:\/\/\//, "")
    .replace(/^webpack:\/\/_N_E\/\.\//, "")
    .replace(/^webpack:\/\/_N_E\//, "")
    .replace(/^webpack:\/\/\.\//, "")
    .replace(/^webpack:\/\/\//, "")
    .replace(/^app:\/\/\//, "")
    .replace(/^app:\/\//, "")
    .replace(/^\.\//, "");
}

function frameFunctionName(frame: StackFrame): string {
  if (frame.function) {
    if (frame.module && !frame.function.startsWith(frame.module) && !frame.function.includes("::")) {
      return `${frame.module}.${frame.function}`;
    }
    return frame.function;
  }
  if (frame.symbol) {
    return frame.symbol;
  }
  if (frame.module) {
    return frame.module;
  }
  return "<anonymous>";
}

function formatFrameCopy(frame: StackFrame): string {
  const fn = frameFunctionName(frame);
  const file = shortFilename(frame.filename);
  const line = frame.lineno != null ? `:${frame.lineno}` : "";
  const col = frame.colno != null ? `:${frame.colno}` : "";
  const context = (frame.context_line ?? frame.context)?.trim();
  return context
    ? `${fn} at ${file}${line}${col}\n${context}`
    : `${fn} at ${file}${line}${col}`;
}

function formatFullStackTrace(
  exception: { type: string; message: string } | null,
  frames: UniqueFrame[],
): string {
  const header = exception ? `${exception.type}: ${exception.message}` : "Error";
  const frameLines = frames.map(({ frame }) => {
    const fn = frameFunctionName(frame);
    const file = shortFilename(frame.filename);
    const line = frame.lineno != null ? `:${frame.lineno}` : "";
    const col = frame.colno != null ? `:${frame.colno}` : "";
    return `    at ${fn} (${file}${line}${col})`;
  });
  return `${header}\n${frameLines.join("\n")}`;
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
        "rounded-sm px-1.5 py-1 text-2xs font-medium focus-ring disabled:pointer-events-none disabled:opacity-40 transition-colors",
        emphasis
          ? "bg-accent/10 text-fg-primary hover:bg-accent/15"
          : "text-fg-muted hover:bg-state-hover hover:text-fg-primary",
      )}
    >
      {children}
    </button>
  );
}

function SegmentToggle({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-sm px-2 py-1 text-2xs font-medium transition-colors focus-ring disabled:opacity-40",
        active
          ? "bg-surface-1 text-fg-primary shadow-sm ring-1 ring-border-subtle"
          : "text-fg-muted hover:bg-surface-1/70 hover:text-fg-primary",
      )}
    >
      {children}
    </button>
  );
}

function StackFrameRow({
  frame,
  expanded,
  vendor,
  nested,
  isCulprit,
  rowRef,
  onToggle,
}: {
  frame: StackFrame;
  expanded: boolean;
  vendor: boolean;
  nested?: boolean;
  isCulprit?: boolean;
  rowRef?: RefObject<HTMLDivElement | null>;
  onToggle: () => void;
}) {
  const path = shortFilename(frame.filename);
  const fn = frameFunctionName(frame);
  const hasCode = hasSourceContext(frame);
  const inApp = !vendor;

  return (
    <div
      ref={rowRef}
      className={cn(
        "epure-stack-frame border-b border-border-subtle last:border-b-0",
        nested && "pl-2",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={!hasCode && !expanded}
        className={cn(
          "flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors focus-ring",
          "hover:bg-state-hover",
          !hasCode && "cursor-default",
          isCulprit && "border-l-2 border-l-accent bg-accent/5",
          expanded && hasCode && "bg-bg-subtle/80",
        )}
      >
        <span className="mt-0.5 shrink-0 text-fg-muted" aria-hidden>
          {hasCode ? (
            expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : (
            <span className="inline-block size-3" />
          )}
        </span>
        <div
          className={cn(
            "min-w-0 flex-1 font-mono text-2xs leading-5 [overflow-wrap:anywhere]",
            vendor ? "text-fg-muted" : "text-fg-primary",
          )}
        >
          <span className="text-fg-muted">at </span>
          <span className={cn(isCulprit ? "font-semibold" : inApp ? "font-medium" : "font-normal")}>{fn}</span>
          <span className="text-fg-muted"> (</span>
          <span className={vendor ? "text-fg-muted" : "text-fg-secondary"}>{path}</span>
          <span className="tabular-nums text-fg-muted">{frameLineColumn(frame)}</span>
          <span className="text-fg-muted">)</span>
        </div>
      </button>
      {expanded && hasCode ? (
        <SourceCodeBlock
          filename={frame.filename ?? "unknown"}
          functionName={frameFunctionName(frame)}
          lineno={frame.lineno}
          colno={frame.colno}
          lines={frameSourceLines(frame)}
          showHeader={false}
          density="stack"
          faultTone="neutral"
          copyValue={formatFrameCopy(frame)}
          className="border-t border-border-subtle bg-bg-subtle px-2 pb-2 pt-1"
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
      className="flex w-full items-center gap-2 border-b border-border-subtle bg-bg-subtle/40 px-3 py-1 text-left text-fg-muted transition-colors hover:bg-state-hover hover:text-fg-primary focus-ring"
    >
      {expanded ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
      <span className="font-mono text-[10px] uppercase tracking-wide">
        {expanded ? "Hide" : "Show"} {count} library frame{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

export interface StackTracePanelProps {
  events: EventDetail[];
  selectedEventId: string | null;
  selectedEvent?: EventDetail | null;
  onSelectEvent: (id: string, event?: EventDetail) => void;
  /** @deprecated Occurrence picker lives in IssueDetailTabs. */
  showOccurrencePicker?: boolean;
  /** Hide exception type/message when the pinned issue header already shows the title. */
  hideExceptionTitle?: boolean;
  /** @deprecated Stack lives on its own tab; kept for API compatibility */
  embedded?: boolean;
  onViewGrouping?: () => void;
}

export function StackTracePanel({
  events,
  selectedEventId,
  selectedEvent: selectedEventProp,
  onSelectEvent,
  showOccurrencePicker = false,
  hideExceptionTitle = true,
}: StackTracePanelProps) {
  const [expandedFrames, setExpandedFrames] = useState<Set<number>>(() => new Set());
  const [expandedVendorRuns, setExpandedVendorRuns] = useState<Record<string, boolean>>({});
  const [inAppOnly, setInAppOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"full" | "raw">("full");
  const [copiedAll, setCopiedAll] = useState(false);
  const { toast } = useToast();
  const culpritRef = useRef<HTMLDivElement>(null);

  const selectedEvent =
    selectedEventProp ??
    events.find((event) => event.id === selectedEventId) ??
    events[0] ??
    null;
  const frames = asStackFrames(selectedEvent?.stack_frames);
  const exception = exceptionFromEvent(selectedEvent);

  const uniqueFrames = useMemo(() => dedupeStackFrames(frames), [frames]);
  const inAppIndices = useMemo(() => inAppFrameIndices(uniqueFrames), [uniqueFrames]);

  const activeFrames = useMemo(() => {
    if (!inAppOnly) return uniqueFrames;
    return uniqueFrames.filter(({ frame }) => !isVendorFrame(frame));
  }, [inAppOnly, uniqueFrames]);

  const stackList = useMemo(() => {
    const reversed = [...activeFrames].reverse();
    const list = buildStackList(reversed);
    return remapStackListIndices(list, activeFrames.length);
  }, [activeFrames]);
  const vendorRunIdList = useMemo(() => vendorRunIds(stackList), [stackList]);
  const culpritIndex = useMemo(() => findCulpritIndex(uniqueFrames), [uniqueFrames]);

  const isFrameExpanded = (index: number) => expandedFrames.has(index);
  const isVendorRunExpanded = (runId: string) => expandedVendorRuns[runId] ?? false;

  const allFramesExpanded =
    activeFrames.length > 0 && activeFrames.every((_, index) => expandedFrames.has(index));

  const allVendorRunsExpanded =
    vendorRunIdList.length === 0 ||
    vendorRunIdList.every((runId) => expandedVendorRuns[runId]);

  const allExpanded = allFramesExpanded && allVendorRunsExpanded;

  const noneExpanded =
    expandedFrames.size === 0 &&
    vendorRunIdList.every((runId) => !expandedVendorRuns[runId]);

  const hasInAppFrames = inAppIndices.length > 0;

  useEffect(() => {
    const next = new Set<number>();
    if (culpritIndex != null) {
      next.add(culpritIndex);
    }
    setExpandedFrames(next);
    setExpandedVendorRuns({});
    setViewMode("full");
  }, [selectedEvent?.id, culpritIndex]);

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
    setExpandedFrames(new Set(activeFrames.map((_, index) => index)));
    setExpandedVendorRuns(Object.fromEntries(vendorRunIdList.map((runId) => [runId, true])));
  };

  const collapseAll = () => {
    setExpandedFrames(new Set());
    setExpandedVendorRuns({});
  };

  const handleCopyAll = async () => {
    try {
      const text = formatFullStackTrace(exception, uniqueFrames);
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      toast("Copied full stack trace to clipboard");
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast("Failed to copy stack trace");
    }
  };

  if (!selectedEvent) {
    return (
      <div className="px-4 py-10 text-center text-xs text-fg-muted">
        Select an issue to inspect the stack.
      </div>
    );
  }

  const exceptionMeta =
    exception && (exception.mechanism != null || exception.handled != null) ? (
      <div className="flex flex-wrap gap-1">
        {exception.mechanism != null ? (
          <Badge variant="neutral" size="compact" className="font-mono font-normal">
            {exception.mechanism}
          </Badge>
        ) : null}
        {exception.handled != null ? (
          <Badge
            variant={exception.handled ? "healthy" : "warning"}
            size="compact"
            className="font-mono font-normal"
          >
            {exception.handled ? "handled" : "unhandled"}
          </Badge>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="epure-stack-trace flex min-h-0 flex-1 flex-col bg-transparent">
      {showOccurrencePicker ? (
        <div className="flex shrink-0 items-center border-b border-border-subtle px-4 py-2 md:px-5">
          <OccurrencePicker
            events={events}
            selectedEventId={selectedEventId}
            selectedEvent={selectedEvent}
            onSelectEvent={onSelectEvent}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 md:px-5">
        {hideExceptionTitle ? (
          exceptionMeta ? <div className="shrink-0">{exceptionMeta}</div> : null
        ) : exception ? (
          <div className="shrink-0 space-y-1">
            <h3 className="text-sm font-medium tracking-ui text-fg-primary">{exception.type}</h3>
            <p className="text-xs leading-snug text-fg-secondary select-text [overflow-wrap:anywhere]">
              {exception.message}
            </p>
            {exceptionMeta}
          </div>
        ) : (
          <p className="shrink-0 text-2xs text-fg-muted">No exception details captured.</p>
        )}

        {/* Hug frame content; cap at panel height and scroll inside when taller. */}
        <div className="epure-code-well flex min-h-0 w-full max-h-full flex-col overflow-hidden rounded-md border border-border bg-surface-1 shadow-xs">
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-1 px-3 py-2">
            <div className="inline-flex rounded-md border border-border-subtle bg-canvas p-0.5">
              <SegmentToggle active={viewMode === "full"} onClick={() => setViewMode("full")}>
                Frames
              </SegmentToggle>
              <SegmentToggle active={viewMode === "raw"} onClick={() => setViewMode("raw")}>
                Raw
              </SegmentToggle>
            </div>

            {viewMode === "full" ? (
              <div className="inline-flex rounded-md border border-border-subtle bg-canvas p-0.5">
                <SegmentToggle active={!inAppOnly} onClick={() => setInAppOnly(false)}>
                  All {uniqueFrames.length}
                </SegmentToggle>
                <SegmentToggle
                  active={inAppOnly}
                  onClick={() => setInAppOnly(true)}
                  disabled={!hasInAppFrames}
                >
                  In-app {inAppIndices.length}
                </SegmentToggle>
              </div>
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-1">
              {viewMode === "full" ? (
                <>
                  <StackToolbarButton onClick={expandAll} disabled={allExpanded}>
                    Expand
                  </StackToolbarButton>
                  <StackToolbarButton onClick={collapseAll} disabled={noneExpanded}>
                    Collapse
                  </StackToolbarButton>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCopyAll()}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-2xs font-medium text-fg-muted hover:bg-state-hover hover:text-fg-primary focus-ring"
              >
                {copiedAll ? <Check className="size-3 text-healthy" /> : <Copy className="size-3" />}
                Copy
              </button>
            </div>
          </header>

          {viewMode === "raw" ? (
            <pre className="min-h-0 overflow-y-auto bg-surface-1 p-3 font-mono text-2xs leading-relaxed text-fg-primary whitespace-pre-wrap select-text">
              {formatFullStackTrace(exception, uniqueFrames)}
            </pre>
          ) : uniqueFrames.length > 0 ? (
            <div className="epure-stack-trace-frames min-h-0 overflow-y-auto bg-surface-1">
              {stackList.map((item) => {
                if (item.type === "frame") {
                  const { frame } = item.entry.unique;
                  const globalIndex = item.entry.globalIndex;
                  return (
                    <StackFrameRow
                      key={item.entry.unique.key}
                      frame={frame}
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
                  <div key={item.runId} className="epure-stack-trace-vendor-run">
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
                          <StackFrameRow
                            key={entry.unique.key}
                            frame={entry.unique.frame}
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
          ) : (
            <div className="bg-surface-1 px-3 py-8 text-center text-sm text-fg-muted">
              No stack frames captured for this occurrence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
