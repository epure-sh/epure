import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Icon,
  Hash,
  EnvelopeSimple,
  DiscordLogo,
  SlackLogo,
  TelegramLogo,
  WebhooksLogo,
  Info,
} from "@/components/ui/icon";
import { fetchAlertChannels, type AlertChannelRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AlertWizardSection } from "./alert-wizard-section";

export interface AlertNotificationFieldsProps {
  projectId: string;
  alertName: string;
  summary: string;
}

function channelGlyph(provider: string) {
  if (provider === "email") return EnvelopeSimple;
  if (provider === "slack") return SlackLogo;
  if (provider === "discord") return DiscordLogo;
  if (provider === "telegram") return TelegramLogo;
  if (provider === "webhook") return WebhooksLogo;
  return Hash;
}

export function AlertNotificationFields({
  projectId,
  alertName,
  summary,
}: AlertNotificationFieldsProps) {
  const name = alertName.trim() || "Untitled alert";
  const [channels, setChannels] = useState<AlertChannelRow[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAlertChannels(projectId)
      .then((rows) => {
        if (cancelled) return;
        setChannels(rows);
        const active = rows.filter((row) => row.is_enabled).slice(0, 3);
        setSelectedChannelIds(new Set(active.map((row) => row.id)));
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
        {loading ? (
          <p className="text-[11px] text-fg-muted">Loading channels…</p>
        ) : channels.length === 0 ? (
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
              const Glyph = channelGlyph(channel.provider);
              const failing = channel.last_test_status === "fail" || Boolean(channel.last_error);
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
                        aria-label={`Notify ${channel.label}`}
                      />
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-surface-2">
                        <Icon icon={Glyph} size={13} className="text-fg-muted" aria-hidden />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="truncate text-[13px] font-medium leading-tight text-fg-primary">
                          {channel.label}
                        </p>
                        <p className="font-mono text-[10px] uppercase leading-none text-fg-muted">
                          {channel.provider}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[10px]",
                        failing ? "text-semantic-danger" : "text-fg-muted",
                      )}
                    >
                      {failing ? "Failing" : channel.is_enabled ? "Connected" : "Needs verify"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AlertWizardSection>

      <div className="flex gap-2 rounded-lg border border-border-subtle bg-surface-2/40 px-2.5 py-2">
        <Icon icon={Info} size={14} className="mt-0.5 shrink-0 text-fg-muted" />
        <p className="text-[11px] leading-relaxed text-fg-muted">
          <span className="font-medium text-fg-primary">{name}</span> will notify the selected
          channels when it fires. {summary}
        </p>
      </div>
    </div>
  );
}
