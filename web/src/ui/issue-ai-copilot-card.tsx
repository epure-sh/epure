import { useState } from "react";
import { Check, Copy, Sparkles, Terminal, Wrench } from "lucide-react";
import type { EventDetail, IssueSummary } from "../lib/api";
import { copyIssueExport } from "../features/issues/export-markdown";
import { useToast } from "./toast-provider";

export interface IssueAiCopilotCardProps {
  issue: IssueSummary;
  event: EventDetail | null;
}

export function extractCulprit(issue: IssueSummary, event: EventDetail | null): string {
  const payload = event?.payload_json as Record<string, unknown> | undefined;
  if (typeof payload?.transaction === "string" && payload.transaction) {
    return payload.transaction;
  }
  if (typeof payload?.culprit === "string" && payload.culprit) {
    return payload.culprit;
  }
  if (Array.isArray(event?.stack_frames) && event.stack_frames.length > 0) {
    const top = event.stack_frames[0] as { filename?: string; lineno?: number };
    if (top?.filename) {
      return top.lineno ? `${top.filename}:${top.lineno}` : top.filename;
    }
  }
  return issue.title ? issue.title.split(":")[0] : "application entrypoint";
}

export function generateAiDiagnosis(issue: IssueSummary, event: EventDetail | null): {
  culprit: string;
  cause: string;
  fix: string;
  confidence: "High" | "Medium";
} {
  const title = (issue.title ?? "").toLowerCase();
  const culprit = extractCulprit(issue, event);

  if (title.includes("typeerror") || title.includes("cannot read") || title.includes("undefined")) {
    return {
      culprit,
      cause: `Null or undefined reference dereferenced in ${culprit}. Property was accessed on an uninitialized object.`,
      fix: `Introduce optional chaining (?.) or defensive null guards prior to reading properties.`,
      confidence: "High",
    };
  }

  if (title.includes("timeout") || title.includes("database") || title.includes("econnrefused")) {
    return {
      culprit,
      cause: `Network or database connection timed out during execution in ${culprit}.`,
      fix: `Audit connection pooling limits, query execution plans, and wrap with exponential backoff retries.`,
      confidence: "High",
    };
  }

  if (title.includes("hydration") || title.includes("react")) {
    return {
      culprit,
      cause: `React hydration mismatch. Client render tree diverged from the server-rendered HTML payload.`,
      fix: `Defer non-deterministic values (Date.now(), window, cookies) until after client component mount.`,
      confidence: "High",
    };
  }

  if (title.includes("nil pointer") || title.includes("nullpointer") || title.includes("panic")) {
    return {
      culprit,
      cause: `Nil/null pointer dereference in ${culprit}.`,
      fix: `Verify object existence or pointer validity before invoking methods or fields.`,
      confidence: "High",
    };
  }

  return {
    culprit,
    cause: `Unhandled exception in ${culprit}.`,
    fix: `Inspect latest event breadcrumbs and verify input parameters leading to this code path.`,
    confidence: "Medium",
  };
}

export function IssueAiCopilotCard({ issue, event }: IssueAiCopilotCardProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const diagnosis = generateAiDiagnosis(issue, event);

  async function handleCopy() {
    try {
      await copyIssueExport(issue, event);
      setCopied(true);
      toast("Copied. Paste into Cursor or your AI assistant.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Unable to copy to clipboard");
    }
  }

  return (
    <div className="epure-ai-card rounded-lg border border-border bg-surface p-3.5 shadow-2xs select-none">
      {/* Header zone: Title, Confidence Tag, and Single Unified Copy for AI Action */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ink-muted shrink-0" />
          <h4 className="text-xs font-semibold tracking-tight text-ink flex items-center gap-1.5">
            <span>AI Root Cause Diagnostic</span>
            <span className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-muted border border-border/60">
              {diagnosis.confidence} confidence
            </span>
          </h4>
        </div>

        {/* One single, clean Copy for AI button using the canonical prompt builder */}
        <button
          type="button"
          onClick={handleCopy}
          className="btn-tactile inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1 text-2xs font-medium text-ink hover:border-border-strong hover:bg-state-hover focus-ring shadow-2xs"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500 stroke-[2.5]" />
              <span>Copied Prompt</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-ink-muted" />
              <span>Copy for AI</span>
            </>
          )}
        </button>
      </div>

      {/* Efficient, high-density diagnostic details */}
      <div className="mt-2.5 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 font-mono text-2xs text-ink-muted">
          <span className="text-ink-subtle font-sans">Culprit:</span>
          <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-ink font-semibold border border-border/70 truncate max-w-md">
            {diagnosis.culprit}
          </span>
        </div>

        <div>
          <span className="font-medium text-ink flex items-center gap-1 text-2xs">
            <Terminal className="h-3 w-3 text-ink-muted shrink-0" />
            <span>Probable Cause:</span>
          </span>
          <p className="mt-0.5 text-ink-muted text-2xs leading-relaxed pl-4">
            {diagnosis.cause}
          </p>
        </div>

        <div>
          <span className="font-medium text-ink flex items-center gap-1 text-2xs">
            <Wrench className="h-3 w-3 text-ink-muted shrink-0" />
            <span>Recommended Fix:</span>
          </span>
          <p className="mt-0.5 text-ink-muted text-2xs leading-relaxed pl-4">
            {diagnosis.fix}
          </p>
        </div>
      </div>
    </div>
  );
}
