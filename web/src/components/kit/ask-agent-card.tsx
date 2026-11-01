// src/components/kit/ask-agent-card.tsx
import * as React from "react";
import { Sparkle, ArrowSquareOut } from "@/components/ui/icon";
import { CopyForAgentsButton } from "@/components/kit/copy-for-agents-button";
import { cn } from "@/lib/utils";

export interface AskAgentCardProps {
  promptText?: string;
  onAskAgent?: () => void;
  docsUrl?: string;
  title?: string;
  description?: string;
  /** Single-row banner — lower height for wizards / side panels. */
  compact?: boolean;
  className?: string;
}

export function AskAgentCard({
  promptText,
  onAskAgent,
  docsUrl = "https://docs.epure.ai",
  title = "Copy a prompt for your AI agent",
  description = "Pastes issue context into the clipboard for Cursor, Claude, or similar. Epure does not run an LLM here.",
  compact = false,
  className,
}: AskAgentCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyOrAsk = async () => {
    if (onAskAgent) {
      onAskAgent();
      return;
    }
    if (promptText) {
      try {
        await navigator.clipboard.writeText(promptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy prompt", err);
      }
    }
  };

  if (compact) {
    return (
      <div
        data-slot="ask-agent-card"
        className={cn(
          "flex items-center gap-2.5 rounded-md border border-border-subtle bg-bg-subtle/80 px-2.5 py-1.5",
          className,
        )}
      >
        <Sparkle className="size-3.5 shrink-0 text-primary" weight="fill" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-fg-primary">{title}</p>
          {description ? (
            <p className="truncate text-2xs text-fg-muted">{description}</p>
          ) : null}
        </div>
        <CopyForAgentsButton
          copied={copied}
          label="Ask agent"
          className="h-7 shrink-0 px-2.5 text-xs"
          onClick={handleCopyOrAsk}
        />
      </div>
    );
  }

  return (
    <div
      data-slot="ask-agent-card"
      className={cn(
        "rounded-panel border border-border-subtle bg-surface-1 p-4 shadow-tactile flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-xs bg-primary/10 text-primary">
            <Sparkle className="size-3.5" weight="fill" />
          </span>
          <h4 className="text-xs font-semibold text-fg-primary">{title}</h4>
        </div>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg-primary transition-colors"
          >
            <span>Docs</span>
            <ArrowSquareOut className="size-3" />
          </a>
        )}
      </div>

      <p className="text-xs text-fg-muted leading-relaxed">{description}</p>

      <div className="flex items-center gap-2 pt-1">
        <CopyForAgentsButton copied={copied} label="Ask agent" onClick={handleCopyOrAsk} />
      </div>
    </div>
  );
}
