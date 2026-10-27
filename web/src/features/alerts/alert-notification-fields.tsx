import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon, Hash, EnvelopeSimple, Radio as RadioIcon, WebhooksLogo, Info } from "@/components/ui/icon";
import { getStoredChannels, type OutputChannel } from "@/features/org/channels";
import { projectSettingsPath } from "@/lib/paths";
import { cn } from "@/lib/cn";
import { AlertWizardSection } from "./alert-wizard-section";

export interface AlertNotificationFieldsProps {
  projectId: string;
  alertName: string;
  summary: string;
}

function channelGlyph(channel: OutputChannel) {
  if (channel.type === "email") return EnvelopeSimple;
  if (channel.type === "slack") return Hash;
  if (channel.type === "discord") return RadioIcon;
  return WebhooksLogo;
}

export function AlertNotificationFields({
  projectId,
  alertName,
  summary,
}: AlertNotificationFieldsProps) {
  const name = alertName.trim() || "Untitled alert";
  const channels = useMemo(() => getStoredChannels(), []);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(() => {
    const active = channels.filter((row) => row.status !== "failing").slice(0, 3);
    return new Set(active.map((row) => row.id));
  });

  const toggleChannel = (id: string) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <AlertWizardSection
        title="Notification targets"
        actions={
          <span className="font-mono text-[10px] tabular-nums text-fg-muted">
            {selectedChannelIds.size} active
          </span>
        }
      >
        {channels.length === 0 ? (
          <p className="text-[11px] text-fg-muted">
            No channels yet.{" "}
            <Button variant="link" size="xs" className="h-auto p-0 text-[11px]" asChild>
              <Link to="/org/channels">Add channel</Link>
            </Button>
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {channels.map((channel) => {
              const checked = selectedChannelIds.has(channel.id);
              const Glyph = channelGlyph(channel);
              const failing = channel.status === "failing";
              return (
                <li key={channel.id}>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5",
                      checked ? "bg-surface-2/80" : "bg-surface-1",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleChannel(channel.id)}
                        aria-label={`Notify ${channel.name}`}
                      />
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-surface-2">
                        <Icon icon={Glyph} size={13} className="text-fg-muted" aria-hidden />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="truncate text-[13px] font-medium leading-tight text-fg-primary">{channel.name}</p>
                        <p className="font-mono text-[10px] uppercase leading-none text-fg-muted">{channel.type}</p>
                      </div>
                    </div>
                    <span className={cn("shrink-0 text-[10px]", failing ? "text-semantic-danger" : "text-fg-muted")}>
                      {failing ? "Failing" : "Connected"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AlertWizardSection>

      <div className="flex gap-2 rounded-lg border border-border-subtle bg-surface-2/40 px-2.5 py-2">
        <Icon icon={Info} size={14} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
        <div className="space-y-1 text-[11px] leading-snug text-fg-secondary">
          <p>
            <span className="font-medium text-fg-primary">{name}</span>
            {": "}
            {summary}
          </p>
          <p className="text-fg-muted">
            Channel picks preview routing. Saved rules notify via subscribed project webhooks until per-rule routing
            ships.
          </p>
        </div>
      </div>

      <Button variant="ghost" size="xs" asChild className="h-7 px-0 text-[11px]">
        <Link to={projectSettingsPath(projectId, "webhooks")}>Manage webhooks</Link>
      </Button>
    </div>
  );
}
