import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchSetupDsn,
  formatDsn,
  sendSetupTestEvent,
} from "../lib/api";
import { projectSettingsPath } from "../lib/paths";
import type { Environment } from "../shell/app-context";
import { Card, CardContent } from "./card";
import { CopyDsnBlock } from "./copy-dsn-block";
import { SetupConnectGuide } from "./setup-connect-guide";
import { useToast } from "./toast-provider";

export interface SetupWaitingPanelProps {
  projectId: string;
  environment: Environment;
  onEnvironmentSync: () => void;
}

type ConnectionPhase = "idle" | "listening" | "sent" | "error";

export function SetupWaitingPanel({
  projectId,
  environment,
  onEnvironmentSync,
}: SetupWaitingPanelProps) {
  const [dsn, setDsn] = useState("");
  const [dsnLoading, setDsnLoading] = useState(true);
  const [testBusy, setTestBusy] = useState(false);
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("idle");
  const { toast } = useToast();

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
      setConnectionPhase("sent");
      toast("Test error sent");
    } catch {
      setConnectionPhase("error");
      toast("Could not send test error");
    } finally {
      setTestBusy(false);
    }
  }, [projectId, toast]);

  const envMismatch = environment !== "production";
  const listening = connectionPhase === "sent" || connectionPhase === "listening";

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium text-ink">Send your first error</p>

          {dsnLoading ? (
            <p className="text-xs text-ink-muted">Loading…</p>
          ) : !dsn ? (
            <p className="text-xs text-ink-muted">
              No DSN key.{" "}
              <Link
                to={projectSettingsPath(projectId, "dsn")}
                className="text-ink underline-offset-2 hover:underline"
              >
                Create in settings
              </Link>
            </p>
          ) : (
            <>
              <CopyDsnBlock dsn={dsn} compact hint={null} />
              <SetupConnectGuide
                dsn={dsn}
                phase="verify"
                onAiCopied={() =>
                  toast("Copied — paste into Cursor or your AI assistant")
                }
                onSendTest={() => void handleSendTest()}
                testBusy={testBusy}
                listening={listening}
                listenError={connectionPhase === "error"}
              />
            </>
          )}

          {envMismatch ? (
            <button
              type="button"
              className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={onEnvironmentSync}
            >
              Switch filter to production
            </button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
