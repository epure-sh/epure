import type { ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SettingsPage({ children }: { children: ReactNode }) {
  return (
    <Box flexDirection="column" gap="l" width="100%" padding="l">
      {children}
    </Box>
  );
}

export function SettingsPageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Text as="h2" variant="heading-xs">
            {title}
          </Text>
          {badge}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="max-w-2xl text-xs text-fg-muted">{description}</p> : null}
    </div>
  );
}

export function SettingsPanel({
  title,
  description,
  actions,
  footer,
  children,
  flush = false,
  danger = false,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border bg-surface-1",
        danger ? "border-semantic-danger/40" : "border-border-subtle",
      )}
    >
      {title || description || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div className="min-w-0">
            {title ? <p className="text-xs font-medium text-fg-primary">{title}</p> : null}
            {description ? <p className="mt-0.5 text-2xs text-fg-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? "" : "px-4 py-4")}>{children}</div>
      {footer ? (
        <div className="border-t border-border-subtle bg-surface-2/40 px-4 py-2.5">{footer}</div>
      ) : null}
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  badge,
  action,
  danger = false,
}: {
  title: string;
  description: string;
  badge?: ReactNode;
  action: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3",
        danger && "bg-semantic-danger/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={cn(
              "text-xs font-medium",
              danger ? "text-semantic-danger" : "text-fg-primary",
            )}
          >
            {title}
          </p>
          {badge}
        </div>
        <p className="mt-0.5 text-2xs text-fg-muted">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function SettingsSkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-border-subtle">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="size-8 animate-pulse rounded-full bg-surface-2" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
            <div className="h-2.5 w-56 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({
  on,
  onLabel = "On",
  offLabel = "Off",
}: {
  on: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <Badge variant={on ? "healthy" : "neutral"} size="compact">
      {on ? onLabel : offLabel}
    </Badge>
  );
}
