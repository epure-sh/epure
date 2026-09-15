import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Radio, Zap } from "lucide-react";
import {
  fetchSetupDsn,
  formatDsn,
  sendSetupTestEvent,
} from "../lib/api";
import { projectSettingsPath } from "../lib/paths";
import type { Environment } from "../shell/app-context";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { CopyDsnBlock } from "./copy-dsn-block";
import { SdkSnippetBlock } from "./sdk-snippet-block";
import { Section, SectionHeader } from "./section";
import { useToast } from "./toast-provider";

export interface SetupWaitingPanelProps {
  projectId: string;
  environment: Environment;
  onEnvironmentSync: () => void;
  testSent: boolean;
  onTestSent: () => void;
}

type ConnectionPhase = "listening" | "sent" | "error";

export function SetupWaitingPanel({
  projectId,
  environment,
  onEnvironmentSync,
  testSent,
  onTestSent,
}: SetupWaitingPanelProps) {
  const [dsn, setDsn] = useState("");
  const [dsnLoading, setDsnLoading] = useState(true);
  const [testBusy, setTestBusy] = useState(false);
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>(
    testSent ? "sent" : "listening",
  );
  const { toast } = useToast();

  useEffect(() => {
    if (testSent) {
      setConnectionPhase("sent");
    }
  }, [testSent]);

  useEffect(() => {
    let cancelled = false;
    setDsnLoading(true);
    void fetchSetupDsn(projectId)
      .then((info) => {
        if (cancelled) {
          return;
        }
        if (info.public_key) {
          setDsn(formatDsn(info.public_key, projectId));
        } else {
          setDsn("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDsn("");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDsnLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSendTest = useCallback(async () => {
    setTestBusy(true);
    setConnectionPhase("listening");
    try {
      await sendSetupTestEvent(projectId);
      onTestSent();
      setConnectionPhase("sent");
      toast("Test error sent — your first issue should appear in a few seconds.");
    } catch {
      setConnectionPhase("error");
      toast("Could not send test error. Check that epure is running.");
    } finally {
      setTestBusy(false);
    }
  }, [onTestSent, projectId, toast]);

  const envMismatch = environment !== "production";

  return (
    <div className="mx-auto w-full max-w-narrow space-y-4 p-6">
      <ConnectionBanner phase={connectionPhase} testBusy={testBusy} />

      <Card>
        <CardHeader>
          <CardTitle>Send your first error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Section variant="inset" density="compact">
            <SectionHeader
              title="Option A — One click (fastest)"
              description="Fires a sample browser exception through your DSN. No SDK required."
            />
            <Button
              variant="signal"
              className="mt-3 gap-2"
              disabled={testBusy || dsnLoading || !dsn}
              onClick={() => void handleSendTest()}
            >
              {testBusy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Send test error
            </Button>
          </Section>

          <Section variant="inset" density="compact">
            <SectionHeader
              title="Option B — Wire your SDK"
              description="Keep your Sentry SDK. Change only the DSN, then trigger any uncaught exception."
            />
            {dsnLoading ? (
              <p className="mt-3 text-sm text-ink-muted">Loading connection string…</p>
            ) : dsn ? (
              <div className="mt-3 space-y-4">
                <CopyDsnBlock dsn={dsn} />
                <SdkSnippetBlock dsn={dsn} environment={environment} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                No DSN key yet.{" "}
                <Link
                  to={projectSettingsPath(projectId, "dsn")}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  Create one in Settings
                </Link>
                .
              </p>
            )}
          </Section>

          {envMismatch ? (
            <Section variant="inset" density="compact">
              <SectionHeader
                title="Environment filter"
                description={`Issues are filtered to "${environment}". The test error and SDK snippet use "production".`}
              />
              <Button variant="secondary" className="mt-3" onClick={onEnvironmentSync}>
                Switch filter to production
              </Button>
            </Section>
          ) : null}

          <div className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-ink-muted">
            <p className="font-medium text-ink">Where to configure later</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <Link
                  to={projectSettingsPath(projectId, "dsn")}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  Settings → DSN keys
                </Link>
                {" "}— rotate or revoke keys
              </li>
              <li>
                <Link
                  to={projectSettingsPath(projectId, "webhooks")}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  Settings → Webhooks
                </Link>
                {" "}— Slack, Discord, generic HTTP
              </li>
              <li>
                <Link
                  to={`/p/${projectId}/releases`}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  Releases
                </Link>
                {" "}— upload sourcemaps for readable stacks
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionBanner({
  phase,
  testBusy,
}: {
  phase: ConnectionPhase;
  testBusy: boolean;
}) {
  const label =
    testBusy
      ? "Sending test error…"
      : phase === "sent"
        ? "Test error accepted — waiting for issue to appear"
        : phase === "error"
          ? "Could not reach ingest — try again"
          : "Listening for your first exception";

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span
        className={
          phase === "sent" || testBusy
            ? "flex h-8 w-8 items-center justify-center rounded-full bg-signal/15 text-signal"
            : phase === "error"
              ? "flex h-8 w-8 items-center justify-center rounded-full bg-semantic-danger/15 text-semantic-danger"
              : "flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"
        }
      >
        {testBusy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Radio size={16} className={phase === "listening" ? "animate-pulse" : undefined} />
        )}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-muted">
          Your grouped issue will show up here automatically — no refresh needed.
        </p>
      </div>
    </div>
  );
}
