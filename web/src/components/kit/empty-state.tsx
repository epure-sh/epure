// src/components/kit/empty-state.tsx — calm empty: quiet type + one next action
import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Button } from "@/components/ui/button";
import { Icon, Tray, type IconType } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type EmptyTone = "first-run" | "calm" | "search" | "blocked";
export type EmptyLayout = "stack" | "inset";

export interface EmptyStateProps {
  /** Soft glyph — Phosphor component or custom node. */
  icon?: IconType | React.ReactNode;
  title: string;
  /** Short why + what happens next. Keep warm, never blaming. */
  description?: string;
  /** Optional reassurance under the description. */
  hint?: string;
  tone?: EmptyTone;
  /** `stack` = centered panel; `inset` = left-aligned inside a list/card. */
  layout?: EmptyLayout;
  actionLabel?: string;
  onAction?: () => void;
  /** Prefer primary for the one next step on first-run. */
  actionVariant?: "primary" | "secondary" | "ghost";
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function resolveIcon(
  icon: EmptyStateProps["icon"],
  tone: EmptyTone,
): React.ReactNode {
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === "function") {
    const Glyph = icon as IconType;
    return <Icon icon={Glyph} size={18} />;
  }
  if (tone === "calm") return <Icon icon={Tray} size={18} />;
  return <Icon icon={Tray} size={18} />;
}

export function EmptyState({
  icon,
  title,
  description,
  hint,
  tone = "first-run",
  layout = "stack",
  actionLabel,
  onAction,
  actionVariant,
  secondaryActionLabel,
  onSecondaryAction,
  action,
  className,
  children,
}: EmptyStateProps) {
  const inset = layout === "inset";
  const resolvedActionVariant =
    actionVariant ?? (tone === "first-run" ? "primary" : "secondary");
  const wellTone =
    tone === "calm"
      ? "bg-healthy/10 text-healthy"
      : tone === "search"
        ? "bg-surface-2 text-fg-muted"
        : tone === "blocked"
          ? "bg-semantic-warning/10 text-semantic-warning"
          : "bg-surface-2 text-fg-muted";

  return (
    <Box
      data-slot="empty-state"
      data-tone={tone}
      data-layout={layout}
      flexDirection="column"
      alignItems={inset ? "start" : "center"}
      justifyContent="center"
      // eslint-disable-next-line no-restricted-syntax -- kit API className
      className={cn(
        inset ? "px-4 py-8 text-left" : "px-6 py-12 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "mb-3 flex size-10 items-center justify-center rounded-lg",
          wellTone,
        )}
        aria-hidden
      >
        {resolveIcon(icon, tone)}
      </div>

      <Text as="h3" variant="label">
        {title}
      </Text>

      {description ? (
        <Box marginTop="xs" maxWidth={420} className={cn(!inset && "text-center")}>
          <Text
            as="p"
            variant="caption"
            color="muted"
          >
            {description}
          </Text>
        </Box>
      ) : null}

      {hint ? (
        <p
          className={cn(
            "mt-2 max-w-sm text-2xs leading-relaxed text-fg-muted/90",
            !inset && "text-center",
          )}
        >
          {hint}
        </p>
      ) : null}

      {action || actionLabel || secondaryActionLabel || children ? (
        <div
          className={cn(
            "mt-4 flex flex-wrap items-center gap-2",
            !inset && "justify-center",
          )}
        >
          {action}
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant={resolvedActionVariant}
              size="sm"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
          {children}
        </div>
      ) : null}
    </Box>
  );
}
