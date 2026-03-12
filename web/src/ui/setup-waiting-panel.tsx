import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSetupDsn, formatDsn } from "../lib/api";
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

export function SetupWaitingPanel({
  projectId,
  environment,
  onEnvironmentSync,
}: SetupWaitingPanelProps) {
  const [dsn, setDsn] = useState("");
  const [dsnLoading, setDsnLoading] = useState(true);
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

  const envMismatch = environment !== "production";

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium tracking-ui text-ink">Waiting for the first error</p>

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
