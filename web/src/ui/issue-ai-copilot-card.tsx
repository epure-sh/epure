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
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-ink-muted" />
            <h4 className="text-xs font-semibold tracking-tight text-ink">
              Starting point for your AI agent
            </h4>
          </div>
          <p className="pl-6 text-[10px] text-ink-muted">
            Local title/stack heuristics — not a server LLM. Copy the prompt into Cursor or Claude.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="btn-tactile inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1 text-2xs font-medium text-ink shadow-2xs hover:border-border-strong hover:bg-state-hover focus-ring"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-healthy stroke-[2.5]" />
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

      <div className="mt-2.5 space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 font-mono text-2xs text-ink-muted">
          <span className="font-sans text-ink-subtle">Likely culprit:</span>
          <span className="max-w-md truncate rounded border border-border/70 bg-bg-subtle px-1.5 py-0.5 font-semibold text-ink">
            {diagnosis.culprit}
          </span>
        </div>

        <div>
          <span className="flex items-center gap-1 text-2xs font-medium text-ink">
            <Terminal className="h-3 w-3 shrink-0 text-ink-muted" />
            <span>Heuristic cause:</span>
          </span>
          <p className="mt-0.5 pl-4 text-2xs leading-relaxed text-ink-muted">{diagnosis.cause}</p>
        </div>

        <div>
          <span className="flex items-center gap-1 text-2xs font-medium text-ink">
            <Wrench className="h-3 w-3 shrink-0 text-ink-muted" />
            <span>Try next:</span>
          </span>
          <p className="mt-0.5 pl-4 text-2xs leading-relaxed text-ink-muted">{diagnosis.fix}</p>
        </div>
      </div>
    </div>
  );
}
