import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  CHANNEL_PROVIDERS,
  type ChannelProvider,
} from "@/components/kit/create-output-channel-model";
import {
  apiErrorStatus,
  fetchMembers,
  fetchProjects,
  patchAlertChannel,
  type AlertChannelRow,
  type MemberRow,
  type ProjectRow,
} from "@/lib/api";
import { useAppContext } from "@/shell/app-context";

function isChannelProvider(value: string): value is ChannelProvider {
  return CHANNEL_PROVIDERS.some((row) => row.id === value);
}

export function EditOutputChannelDialog({
  channel,
  open,
  onOpenChange,
  onSaved,
}: {
  channel: AlertChannelRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (channel: AlertChannelRow) => void;
}) {
  const { projects: contextProjects } = useAppContext();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [label, setLabel] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [url, setUrl] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [busy, setBusy] = useState(false);

  const provider = channel && isChannelProvider(channel.provider) ? channel.provider : null;
  const providerMeta = CHANNEL_PROVIDERS.find((row) => row.id === provider);

  const projectChoices = useMemo(() => {
    const rows = projects.length > 0 ? projects : contextProjects;
    return Array.isArray(rows) ? rows : [];
  }, [projects, contextProjects]);

  useEffect(() => {
    if (!open || !channel) return;
    setLabel(channel.label);
    setProjectIds(channel.project_ids ?? [channel.project_id]);
    setEnabled(channel.is_enabled);
    setUrl("");
    setBotToken("");
    setChatId(channel.config?.chat_id ?? "");
    setRecipients(
      Array.isArray(channel.config?.recipients)
        ? channel.config.recipients.filter((email): email is string => typeof email === "string")
        : [],
    );

    let cancelled = false;
    void Promise.all([fetchProjects(), fetchMembers()])
      .then(([projectRows, memberRows]) => {
        if (cancelled) return;
        setProjects(projectRows);
        setMembers(memberRows);
      })
      .catch(() => {
        if (cancelled) return;
        setProjects(contextProjects);
        setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, channel, contextProjects]);

  async function handleSave() {
    if (!channel || !provider) return;
    const nextLabel = label.trim();
    if (!nextLabel) {
      toast.error("Name is required");
      return;
    }
    if (projectIds.length === 0) {
      toast.error("Select a project");
      return;
    }

    const config: {
      url?: string;
      recipients?: string[];
      bot_token?: string;
      chat_id?: string;
    } = {};

    if (provider === "email") {
      if (recipients.length === 0) {
        toast.error("Pick at least one recipient");
        return;
      }
      config.recipients = recipients;
    } else if (provider === "telegram") {
      const nextChat = chatId.trim();
      if (!nextChat) {
        toast.error("Chat id is required");
        return;
      }
      config.chat_id = nextChat;
      if (botToken.trim()) config.bot_token = botToken.trim();
    } else if (url.trim()) {
      if (!url.trim().startsWith("https://")) {
        toast.error("URL must start with https://");
        return;
      }
      config.url = url.trim();
    }

    setBusy(true);
    try {
      const updated = await patchAlertChannel(channel.id, {
        label: nextLabel,
        project_ids: projectIds,
        is_enabled: enabled,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      onSaved?.(updated);
      onOpenChange(false);
      toast.success("Channel updated");
    } catch (err) {
      toast.error(
        apiErrorStatus(err) === 400
          ? "Could not update. Check URL, token, or recipients."
          : "Could not update channel",
      );
    } finally {
      setBusy(false);
    }
  }

  const destinationPreview = channel?.config?.destination_preview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(calc(100dvh-2rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border-subtle px-6 py-4">
          <DialogTitle>Edit output channel</DialogTitle>
          <DialogDescription>
            {providerMeta
              ? `Update ${providerMeta.label} delivery settings for this channel.`
              : "Update delivery settings for this channel."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <Field label="Provider">
            <Input value={providerMeta?.label ?? channel?.provider ?? ""} disabled className="h-8" />
          </Field>

          <Field label="Name">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={128}
              className="h-8"
              autoFocus
            />
          </Field>

          <Field label="Projects" hint="Alerts from these projects can deliver here.">
            <Box as="fieldset" flexDirection="column" gap="s">
              {projectChoices.map((project) => (
                <Box as="label" key={project.id} alignItems="center" gap="s">
                  <Checkbox checked={projectIds.includes(project.id)} onCheckedChange={(checked) => setProjectIds((current) => checked === true ? [...new Set([...current, project.id])] : current.filter((id) => id !== project.id))} />
                  <Text>{project.name}</Text>
                </Box>
              ))}
            </Box>
          </Field>

          {provider === "email" ? (
            <Field label="Recipients" hint="Org members only.">
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border-subtle bg-surface-2 p-2">
                {members.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-fg-muted">No members loaded.</p>
                ) : (
                  members.map((member) => {
                    const checked = recipients.includes(member.email);
                    return (
                      <label
                        key={member.email}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface-1"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            const on = next === true;
                            setRecipients((current) =>
                              on
                                ? [...current, member.email]
                                : current.filter((email) => email !== member.email),
                            );
                          }}
                        />
                        <span className="min-w-0 truncate text-xs text-fg-primary">
                          {member.display_name || member.email}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </Field>
          ) : provider === "telegram" ? (
            <>
              <Field
                label="Bot token"
                hint="Leave blank to keep the current token. Stored server-side only."
              >
                <Input
                  type="password"
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder="•••••••• (unchanged)"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8"
                />
              </Field>
              <Field label="Chat id">
                <Input
                  value={chatId}
                  onChange={(event) => setChatId(event.target.value)}
                  placeholder="-100… or @alerts"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8"
                />
              </Field>
            </>
          ) : provider ? (
            <Field
              label={
                provider === "slack"
                  ? "Slack Incoming Webhook URL"
                  : provider === "discord"
                    ? "Discord webhook URL"
                    : "HTTPS endpoint"
              }
              hint={
                destinationPreview
                  ? `Current: ${destinationPreview}. Paste a new https:// URL to replace it.`
                  : "Paste a new https:// URL to replace the destination."
              }
            >
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://… (leave blank to keep)"
                autoComplete="off"
                spellCheck={false}
                className="h-8"
              />
            </Field>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-primary">Enabled</p>
              <p className="text-2xs text-fg-muted">Off pauses deliveries without deleting the channel.</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Channel enabled"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border-subtle px-6 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || !channel}
            onClick={() => void handleSave()}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-fg-primary">{label}</p>
        {hint ? <p className="text-2xs text-fg-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
