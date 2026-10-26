import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { projectSettingsPath } from "@/lib/paths";

export interface AlertNotificationFieldsProps {
  projectId: string;
  alertName: string;
  summary: string;
}

/** Step 3 — where notifications go (PostHog-style delivery block). */
export function AlertNotificationFields({ projectId, alertName, summary }: AlertNotificationFieldsProps) {
  const name = alertName.trim() || "Untitled alert";

  return (
    <div className="space-y-3">
      <section className="space-y-2 rounded-md border border-border bg-bg-subtle/60 p-3">
        <h4 className="text-xs font-medium text-fg-primary">Delivery</h4>
        <p className="text-[11px] leading-snug text-fg-muted">
          Email alerts for this project plus any connected Slack or Discord webhooks subscribed to alert events.
        </p>
        <Button variant="ghost" size="xs" asChild>
          <Link to={projectSettingsPath(projectId, "webhooks")}>Manage channels</Link>
        </Button>
      </section>
      <section className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-2.5">
        <p className="text-xs leading-relaxed text-fg-secondary">
          <span className="font-medium text-fg-primary">{name}</span>
          {" · "}
          {summary}
        </p>
      </section>
    </div>
  );
}
