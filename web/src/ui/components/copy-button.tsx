// web/src/ui/components/copy-button.tsx
// Tier 2 Component: Consolidated Copy Button (Cluster 1)
// Consolidates copy-button, apply-with-ai-button, and inline copy controls.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { copyText } from "@/lib/copy-text";
import { Button, type ButtonProps } from "../primitives";
import { AgentVendorAvatars } from "./agent-vendor-avatars";

export type CopyButtonVariant = "default" | "ai" | "icon-only" | "inline";
export type CopyButtonProminence = "default" | "main";
export type CopyButtonSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "toolbar"
  | "default"
  | "icon"
  | "icon-xs";

export interface CopyButtonProps {
  /** Text to copy to clipboard (or use prompt for AI variant) */
  value?: string;
  /** Synonym for value when using AI prompt copy */
  prompt?: string;
  /** Visual & functional variant */
  variant?: CopyButtonVariant;
  /** Setup / prominent actions — primary fill, larger hit target */
  prominence?: CopyButtonProminence;
  /** Button sizing tier */
  size?: CopyButtonSize;
  /** Initial label (default: "Copy" or "Implement with agent") */
  label?: string;
  /** Feedback label after successful copy (default: "Copied") */
  copiedLabel?: string;
  /** Tooltip or title attribute */
  tooltip?: string;
  /** Button style variant override */
  buttonVariant?: ButtonProps["variant"];
  /** Callback fired on successful clipboard copy */
  onCopied?: () => void;
  /** Callback fired when clipboard write fails */
  onCopyFailed?: () => void;
  /** Disables the button */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

export function CopyButton({
  value,
  prompt,
  variant = "default",
  prominence = "default",
  size,
  label,
  copiedLabel = "Copied",
  tooltip,
  buttonVariant,
  onCopied,
  onCopyFailed,
  disabled,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const textToCopy = value ?? prompt ?? "";
  const isAi = variant === "ai";
  const isMain = prominence === "main";
  const isIconOnly = variant === "icon-only";
  const isInline = variant === "inline";

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (!textToCopy) return;
    try {
      const ok = await copyText(textToCopy);
      if (ok) {
        setCopied(true);
        onCopied?.();
        return;
      }
      onCopyFailed?.();
      onCopied?.();
    } catch {
      onCopyFailed?.();
    }
  }, [textToCopy, onCopied, onCopyFailed]);

  // Resolve button variant
  const resolvedButtonVariant: ButtonProps["variant"] =
    buttonVariant ??
    (isMain
      ? "primary"
      : isAi
        ? "ghost"
        : isIconOnly || isInline
          ? "ghost"
          : "secondary");

  // Resolve size
  const resolvedSize: ButtonProps["size"] =
    size ??
    (isMain
      ? "lg"
      : isIconOnly
        ? "icon"
        : isInline
          ? "icon-xs"
          : isAi
            ? "sm"
            : "sm");

  const defaultLabel = isAi ? "Implement with agent" : "Copy";
  const displayLabel = label ?? defaultLabel;
  const ariaLabelText = copied
    ? isAi
      ? "Copied prompt for agent"
      : copiedLabel
    : isAi
      ? `${displayLabel}, copy prompt`
      : displayLabel;

  if (isInline) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          void handleCopy();
        }}
        className={cn(
          "shrink-0 rounded p-0.5 text-fg-muted transition-colors hover:bg-state-hover hover:text-fg-primary focus-ring",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        title={tooltip ?? ariaLabelText}
        aria-label={ariaLabelText}
      >
        {copied ? (
          <Check className="h-3 w-3 text-healthy" aria-hidden />
        ) : (
          <Copy className="h-3 w-3" aria-hidden />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={resolvedButtonVariant}
      size={resolvedSize}
      disabled={disabled}
      className={cn(
        "gap-1.5",
        isIconOnly && "p-0",
        !isMain && resolvedSize === "default" && "text-sm",
        !isMain && resolvedSize !== "default" && "text-xs",
        className,
      )}
      onClick={() => void handleCopy()}
      title={tooltip}
      aria-label={ariaLabelText}
    >
      {copied ? (
        <Check
          size={isIconOnly ? 14 : 13}
          strokeWidth={isAi ? 2.5 : 2}
          className={cn(isAi && "text-healthy")}
          aria-hidden
        />
      ) : isAi ? (
        <AgentVendorAvatars size={18} />
      ) : (
        <Copy size={13} aria-hidden />
      )}
      {!isIconOnly && <span>{copied ? copiedLabel : displayLabel}</span>}
    </Button>
  );
}

/** Drop-in backwards-compatible wrapper for ApplyWithAiButton */
export interface ApplyWithAiButtonProps {
  prompt: string;
  className?: string;
  size?: "sm" | "toolbar" | "default";
  variant?: "ghost" | "secondary" | "primary";
  prominence?: "default" | "main";
  /** Default: Implement with agent (setup / wire prompts). */
  label?: string;
  onCopied?: () => void;
  onCopyFailed?: () => void;
}

export function ApplyWithAiButton({
  prompt,
  className,
  size = "sm",
  variant = "ghost",
  prominence = "default",
  label = "Implement with agent",
  onCopied,
  onCopyFailed,
}: ApplyWithAiButtonProps) {
  return (
    <CopyButton
      prompt={prompt}
      variant="ai"
      size={size}
      label={label}
      buttonVariant={variant}
      prominence={prominence}
      onCopied={onCopied}
      onCopyFailed={onCopyFailed}
      className={className}
    />
  );
}

/** Drop-in backwards-compatible inline copy button */
export function InlineCopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return <CopyButton value={value} variant="inline" className={className} />;
}
