import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EPURE_DOCS_QUICKSTART_URL } from "../lib/docs-url";
import { projectPath, projectSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";
import { Button } from "./button";

function DocsLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent underline-offset-2 hover:underline focus-ring"
    >
      {children}
    </a>
  );
}

export interface SetupWaitingBannerProps {
  projectId: string;
  className?: string;
}

export function SetupWaitingBanner({ projectId, className }: SetupWaitingBannerProps) {
  return (
    <div
      className={cn(
        "epure-setup-waiting-banner flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-bg-subtle px-4 py-2",
        className,
      )}
    >
      <p className="text-xs tracking-ui text-ink-muted">
        No errors received yet. That's normal if the app hasn't thrown. Verify the DSN in your
        app, or see the{" "}
        <DocsLink href={EPURE_DOCS_QUICKSTART_URL}>quickstart</DocsLink>
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
    </div>
  );
}

const TEST_DATA_STORAGE_PREFIX = "epure.dismiss.test-data";

export interface TestDataBannerProps {
  projectId: string;
  className?: string;
}

export function TestDataBanner({ projectId, className }: TestDataBannerProps) {
  const storageKey = `${TEST_DATA_STORAGE_PREFIX}.${projectId}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "epure-test-data-banner flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-bg-subtle px-4 py-2",
        className,
      )}
    >
      <p className="text-xs tracking-ui text-ink-muted">
        Preview · test data only — sample errors, not from your apps
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => {
          localStorage.setItem(storageKey, "1");
          setDismissed(true);
        }}
      >
        Dismiss
      </Button>
    </div>
  );
}
