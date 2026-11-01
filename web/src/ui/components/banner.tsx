// web/src/ui/components/banner.tsx
// Tier 2 Component: Consolidated Banner & Context Strip (Cluster 2)
// Consolidates fair-use-banner, regression-strip, issues-context-strip,
// issues-home-hint, and setup-status-banner.

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { EPURE_DOCS_QUICKSTART_URL } from "@/lib/docs-url";
import { projectPath, projectSettingsPath } from "@/lib/paths";
import { Button } from "../primitives";

export type BannerTone = "neutral" | "warning" | "danger" | "signal" | "info";
export type BannerVariant = "strip" | "card" | "callout";

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Visual emphasis tone mapped to semantic status colors */
  tone?: BannerTone;
  /** Layout presentation style */
  variant?: BannerVariant;
  /** Primary headline or title */
  title?: ReactNode;
  /** Descriptive body copy */
  description?: ReactNode;
  /** Action slot (buttons or links) */
  action?: ReactNode;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** LocalStorage key for persisting dismissed state */
  dismissStorageKey?: string;
  /** Callback fired when dismissed */
  onDismiss?: () => void;
  /** Optional icon displayed before the content */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const TONE_BORDER_CLASSES: Record<BannerTone, string> = {
  neutral: "border-l-border",
  warning: "border-l-semantic-warning",
  danger: "border-l-semantic-danger",
  signal: "border-l-signal",
  info: "border-l-accent",
};

export function Banner({
  tone = "neutral",
  variant = "strip",
  title,
  description,
  action,
  dismissible = false,
  dismissStorageKey,
  onDismiss,
  icon,
  children,
  className,
  ...props
}: BannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissStorageKey) return false;
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(dismissStorageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!dismissStorageKey) return;
    try {
      setDismissed(localStorage.getItem(dismissStorageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissStorageKey]);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    if (dismissStorageKey) {
      try {
        localStorage.setItem(dismissStorageKey, "1");
      } catch {
        // ignore localStorage errors
      }
    }
    setDismissed(true);
    onDismiss?.();
  };

  const hasLeftAccent = tone !== "neutral" || variant === "callout";

  return (
    <div
      role="region"
      aria-label={typeof title === "string" ? title : "Notification banner"}
      data-slot="banner"
      data-tone={tone}
      data-variant={variant}
      className={cn(
        "epure-banner transition-colors select-none",
        // Variant base styles
        variant === "strip" && [
          "flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-border bg-bg-subtle/50 epure-page-gutter-x py-2",
          hasLeftAccent && ["border-l-[3px]", TONE_BORDER_CLASSES[tone]],
        ],
        variant === "card" && [
          "rounded-lg border border-border bg-surface p-4 shadow-2xs",
          hasLeftAccent && ["border-l-[3px]", TONE_BORDER_CLASSES[tone]],
        ],
        variant === "callout" && [
          "rounded-sm border border-border border-l-[3px] bg-surface p-3 text-sm text-ink",
          TONE_BORDER_CLASSES[tone],
        ],
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-xs font-medium tracking-tight text-ink">
              {title}
            </div>
          ) : null}
          {description ? (
            <div className="text-xs text-ink-muted leading-relaxed">
              {description}
            </div>
          ) : null}
          {children}
        </div>
      </div>

      {(action || dismissible || dismissStorageKey) ? (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {(dismissible || dismissStorageKey) ? (
            <Button
              variant="ghost"
              size="toolbar"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Specialized Consolidated Subcomponents for 100% Backwards Compatibility
// ---------------------------------------------------------------------------

export interface FairUseBannerProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function FairUseBanner({ className, message, ...props }: FairUseBannerProps) {
  return (
    <Banner
      tone="warning"
      variant="callout"
      description={message}
      className={cn("epure-fair-use-banner", className)}
      {...props}
    />
  );
}

export interface RegressionStripProps {
  count: number;
  onViewRegressions: () => void;
  className?: string;
}

export function RegressionStrip({
  count,
  onViewRegressions,
  className,
}: RegressionStripProps) {
  if (count <= 0) {
    return null;
  }

  const label =
    count === 1
      ? "1 exception came back after you resolved it."
      : `${count} exceptions came back after you resolved them.`;

  return (
    <Banner
      tone="danger"
      variant="strip"
      description={<p className="text-sm text-ink">{label}</p>}
      action={
        <Button variant="secondary" className="h-7 shrink-0 text-xs" onClick={onViewRegressions}>
          Show came back
        </Button>
      }
      className={cn("epure-regression-strip py-2.5", className)}
    />
  );
}

export interface IssuesContextStripProps {
  regressionCount?: number;
  showHint?: boolean;
  onViewRegressions?: () => void;
  className?: string;
}

const HINT_STORAGE_KEY = "epure.dismiss.issues-no-chart-hint";

export function IssuesContextStrip({
  regressionCount = 0,
  showHint = false,
  onViewRegressions,
  className,
}: IssuesContextStripProps) {
  const [hintDismissed, setHintDismissed] = useState(true);

  useEffect(() => {
    try {
      setHintDismissed(localStorage.getItem(HINT_STORAGE_KEY) === "1");
    } catch {
      setHintDismissed(true);
    }
  }, []);

  const showRegression = regressionCount > 0 && Boolean(onViewRegressions);
  const showHintRow = showHint && !hintDismissed;

  if (!showHintRow && !showRegression) {
    return null;
  }

  const regressionLabel =
    regressionCount === 1
      ? "1 exception came back"
      : `${regressionCount} exceptions came back`;

  const handleDismissHint = () => {
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setHintDismissed(true);
  };

  return (
    <Banner
      tone={showRegression ? "danger" : "neutral"}
      variant="strip"
      className={cn("epure-context-strip py-1.5", className)}
      description={
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {showHintRow ? (
            <p className="text-xs text-ink-muted">
              Tap a stat to filter. Velocity spikes show on Alerts.
            </p>
          ) : null}
          {showRegression ? (
            <p className="text-xs text-ink">{regressionLabel}</p>
          ) : null}
        </div>
      }
      action={
        <div className="flex shrink-0 items-center gap-2">
          {showRegression && onViewRegressions ? (
            <Button variant="secondary" size="toolbar" onClick={onViewRegressions}>
              Show came back
            </Button>
          ) : null}
          {showHintRow ? (
            <Button variant="ghost" size="toolbar" onClick={handleDismissHint}>
              Dismiss
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

export interface IssuesHomeHintProps {
  className?: string;
}

export function IssuesHomeHint({ className }: IssuesHomeHintProps) {
  return (
    <Banner
      variant="strip"
      tone="neutral"
      dismissStorageKey={HINT_STORAGE_KEY}
      description={
        <p className="text-xs text-ink-muted">
          The list is home. Tap a stat to filter. Velocity spikes show up on Alerts.
        </p>
      }
      className={cn("epure-home-hint py-2", className)}
    />
  );
}

export interface SetupWaitingBannerProps {
  projectId: string;
  className?: string;
}

export function SetupWaitingBanner({ projectId, className }: SetupWaitingBannerProps) {
  return (
    <Banner
      variant="strip"
      tone="neutral"
      className={cn("epure-setup-waiting-banner py-2", className)}
      description={
        <p className="text-xs tracking-ui text-ink-muted">
          No errors received yet. That's normal if the app hasn't thrown. Verify the DSN in your
          app, or see the{" "}
          <a
            href={EPURE_DOCS_QUICKSTART_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline-offset-2 hover:underline focus-ring"
          >
            quickstart
          </a>
          {" · "}
          <Link
            to={projectPath(projectId, "setup")}
            className="font-medium text-accent underline-offset-2 hover:underline focus-ring"
          >
            setup
          </Link>
          {" · "}
          <Link
            to={projectSettingsPath(projectId, "dsn")}
            className="text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-ring"
          >
            DSN settings
          </Link>
          .
        </p>
      }
    />
  );
}

export interface TestDataBannerProps {
  projectId: string;
  className?: string;
}

const TEST_DATA_STORAGE_PREFIX = "epure.dismiss.test-data";

export function TestDataBanner({ projectId, className }: TestDataBannerProps) {
  const storageKey = `${TEST_DATA_STORAGE_PREFIX}.${projectId}`;
  return (
    <Banner
      variant="strip"
      tone="neutral"
      dismissStorageKey={storageKey}
      description={
        <p className="text-xs tracking-ui text-ink-muted">
          Preview · test data only. Sample errors, not from your apps
        </p>
      }
      className={cn("epure-test-data-banner py-2", className)}
    />
  );
}
