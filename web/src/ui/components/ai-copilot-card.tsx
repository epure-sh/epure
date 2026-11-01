// web/src/ui/components/ai-copilot-card.tsx
// Tier 2 Component: Consolidated AI Copilot Card (Cluster 5)
// Consolidates ask-agent-card and issue-ai-copilot-card.

import * as React from "react";
import { Check, ExternalLink, Sparkles, Terminal, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import type { EventDetail, IssueSummary } from "@/lib/api";
import { copyIssueExport } from "@/features/issues/export-markdown";
import { CopyForAgentsButton } from "@/components/kit/copy-for-agents-button";
import { Button } from "../primitives";
import { AgentVendorAvatars } from "./agent-vendor-avatars";
import { useToast } from "./toast-provider";

export type AiCopilotCardVariant = "prompt" | "diagnosis" | "compact";

export interface AiCopilotCardProps {
  /** Visual layout & behavior variant */
  variant?: AiCopilotCardVariant;
  /** Primary card header title */
  title?: string;
  /** Card description copy */
  description?: string;
  /** Link to documentation */
  docsUrl?: string;
  /** Raw prompt text to copy to clipboard */
  promptText?: string;
  /** Issue summary data for heuristic analysis */
  issue?: IssueSummary;
  /** Event detail data for heuristic analysis */
  event?: EventDetail | null;
  /** Shorthand for variant="compact" */
  compact?: boolean;
  /** Callback fired when user clicks ask/copy action */
  onAskAgent?: () => void;
  /** Callback fired after prompt successfully copied */
  onCopied?: () => void;
  className?: string;
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

export function generateAiDiagnosis(
  issue: IssueSummary,
  event: EventDetail | null,
): {
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

export function AiCopilotCard({
  variant,
  title,
  description,
  docsUrl = "https://docs.epure.ai",
  promptText,
  issue,
  event,
  compact = false,
  onAskAgent,
  onCopied,
  className,
}: AiCopilotCardProps) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();

  const resolvedVariant: AiCopilotCardVariant =
    variant ?? (compact ? "compact" : issue ? "diagnosis" : "prompt");

  const diagnosis = React.useMemo(() => {
    if (issue) {
      return generateAiDiagnosis(issue, event ?? null);
    }
    return null;
  }, [issue, event]);

  const handleAction = async () => {
    if (onAskAgent) {
      onAskAgent();
      return;
    }

    if (issue) {
      try {
        await copyIssueExport(issue, event ?? null);
        setCopied(true);
        toast("Copied. Paste into Cursor or your AI assistant.");
        onCopied?.();
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast("Unable to copy to clipboard");
      }
      return;
    }

    if (promptText) {
      try {
        await navigator.clipboard.writeText(promptText);
        setCopied(true);
        toast("Copied prompt for AI agent");
        onCopied?.();
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast("Unable to copy to clipboard");
      }
    }
  };

  // Compact Variant (single-row banner for sidebars / modals)
  if (resolvedVariant === "compact") {
    const compactTitle = title ?? (issue ? "Ask AI Copilot" : "Copy a prompt for your AI agent");
    const compactDescription =
      description ??
      (issue
        ? `Investigate ${issue.title || "issue"}`
        : "Pastes context into your clipboard for Cursor or Claude");

    return (
      <div
        data-slot="ai-copilot-card"
        data-variant="compact"
        className={cn(
          "flex items-center gap-2.5 rounded-md border border-border-subtle bg-bg-subtle/80 px-2.5 py-1.5 select-none",
          className,
        )}
      >
        <Sparkles className="size-3.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-fg-primary">{compactTitle}</p>
          {compactDescription ? (
            <p className="truncate text-2xs text-fg-muted">{compactDescription}</p>
          ) : null}
        </div>
        <Button variant="primary" size="xs" className="shrink-0 gap-1.5" onClick={handleAction}>
          {copied ? (
            <Check className="size-3 stroke-[2.5]" />
          ) : (
            <AgentVendorAvatars size={16} />
          )}
          <span>{copied ? "Copied" : "Ask agent"}</span>
        </Button>
      </div>
    );
  }

  // Diagnosis Variant (Heuristic diagnosis card with culprit, cause, and fix)
  if (resolvedVariant === "diagnosis" && diagnosis) {
    return (
      <div
        data-slot="ai-copilot-card"
        data-variant="diagnosis"
        className={cn(
          "epure-ai-card rounded-lg border border-border bg-surface p-3.5 shadow-2xs select-none",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-ink-muted" />
              <h4 className="text-xs font-semibold tracking-tight text-ink">
                {title ?? "Starting point for your AI agent"}
              </h4>
            </div>
            <p className="pl-6 text-[10px] text-ink-muted">
              {description ??
                "Local title/stack heuristics, not a server LLM. Copy the prompt into Cursor or Claude."}
            </p>
          </div>

          <CopyForAgentsButton
            copied={copied}
            label="Copy for agent"
            copiedLabel="Copied"
            className="shrink-0 h-8 text-xs"
            onClick={handleAction}
          />
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

  // Prompt Variant (General prompt copy card)
  const promptTitle = title ?? "Copy a prompt for your AI agent";
  const promptDescription =
    description ??
    "Pastes issue context into the clipboard for Cursor, Claude, or similar. Epure does not run an LLM here.";

  return (
    <div
      data-slot="ai-copilot-card"
      data-variant="prompt"
      className={cn(
        "rounded-panel border border-border-subtle bg-surface-1 p-4 shadow-tactile flex flex-col gap-3 select-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-xs bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </span>
          <h4 className="text-xs font-semibold text-fg-primary">{promptTitle}</h4>
        </div>
        {docsUrl ? (
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg-primary transition-colors focus-ring"
          >
            <span>Docs</span>
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      <p className="text-xs text-fg-muted leading-relaxed">{promptDescription}</p>

      <div className="flex items-center gap-2 pt-1">
        <CopyForAgentsButton
          copied={copied}
          label="Ask agent"
          copiedLabel="Copied"
          onClick={handleAction}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards Compatibility Wrappers
// ---------------------------------------------------------------------------

export interface AskAgentCardProps {
  promptText?: string;
  onAskAgent?: () => void;
  docsUrl?: string;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}

export function AskAgentCard(props: AskAgentCardProps) {
  return <AiCopilotCard variant={props.compact ? "compact" : "prompt"} {...props} />;
}

export interface IssueAiCopilotCardProps {
  issue: IssueSummary;
  event: EventDetail | null;
}

export function IssueAiCopilotCard(props: IssueAiCopilotCardProps) {
  return <AiCopilotCard variant="diagnosis" {...props} />;
}
