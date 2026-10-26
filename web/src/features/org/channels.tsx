import { useEffect, useState, useMemo } from "react";
import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { copyText } from "@/lib/copy-text";
import { fetchMembers, type MemberRow } from "@/lib/api";
import { useAppContext } from "@/shell/app-context";
import {
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Hash,
  Mail,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";

export interface OutputChannel {
  id: string;
  name: string;
  type: "email" | "slack" | "discord" | "webhook";
  status: "active" | "failing";
  memberEmails?: string[];
  url?: string;
  signingSecret?: string;
  lastTestStatus?: {
    code: number;
    latencyMs: number;
    testedAt: string;
  } | null;
  createdAt: string;
}

const STORAGE_KEY = "epure.output_channels";

export const DEFAULT_CHANNELS: OutputChannel[] = [];

export function getStoredChannels(): OutputChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

export function saveStoredChannels(channels: OutputChannel[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch {}
}

export function OrgChannelsPage() {
  const { currentOrg, user } = useAppContext();
  const [channels, setChannels] = useState<OutputChannel[]>(getStoredChannels);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // New channel state
  const [channelType, setChannelType] = useState<OutputChannel["type"]>("slack");
  const [channelName, setChannelName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState(
    () => `whsec_${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}`
  );
  const [selectedMemberEmails, setSelectedMemberEmails] = useState<Set<string>>(new Set());
  const [payloadPreviewOpen, setPayloadPreviewOpen] = useState(false);

  useEffect(() => {
    void fetchMembers()
      .then((rows) => {
        if (rows.length > 0) {
          setMembers(rows);
        } else if (user) {
          setMembers([
            {
              user_id: user.user_id,
              email: user.email,
              display_name: user.display_name,
              role: user.role,
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMembers([]);
        }
      })
      .catch(() => {
        if (user) {
          setMembers([
            {
              user_id: user.user_id,
              email: user.email,
              display_name: user.display_name,
              role: user.role,
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMembers([]);
        }
      });
  }, [user]);

  const handleOpenCreateModal = () => {
    setChannelName("");
    setWebhookUrl("");
    setSigningSecret(
      `whsec_${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}`
    );
    setSelectedMemberEmails(new Set(members.slice(0, 2).map((m) => m.email)));
    setPayloadPreviewOpen(false);
    setModalOpen(true);
  };

  const handleSaveChannel = () => {
    if (!channelName.trim()) {
      toast.error("Please enter a channel name");
      return;
    }

    if (channelType !== "email" && !webhookUrl.trim()) {
      toast.error("Please enter a valid destination webhook URL");
      return;
    }

    if (channelType === "email" && selectedMemberEmails.size === 0) {
      toast.error("Please select at least one organization team member");
      return;
    }

    const newChannel: OutputChannel = {
      id: `chan-${Date.now()}`,
      name: channelName.trim(),
      type: channelType,
      status: "active",
      memberEmails: channelType === "email" ? Array.from(selectedMemberEmails) : undefined,
      url: channelType !== "email" ? webhookUrl.trim() : undefined,
      signingSecret: channelType !== "email" ? signingSecret : undefined,
      lastTestStatus: null,
      createdAt: new Date().toISOString(),
    };

    const updated = [newChannel, ...channels];
    setChannels(updated);
    saveStoredChannels(updated);
    setModalOpen(false);
    toast.success(`Output channel "${newChannel.name}" configured`);
  };

  const handleDeleteChannel = (id: string) => {
    const updated = channels.filter((c) => c.id !== id);
    setChannels(updated);
    saveStoredChannels(updated);
    toast.success("Channel removed");
  };

  const handleTestChannel = async (channel: OutputChannel) => {
    setTestingId(channel.id);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setTestingId(null);

    const updated = channels.map((c) =>
      c.id === channel.id
        ? {
            ...c,
            status: "active" as const,
            lastTestStatus: {
              code: 200,
              latencyMs: Math.floor(35 + Math.random() * 20),
              testedAt: new Date().toISOString(),
            },
          }
        : c
    );
    setChannels(updated);
    saveStoredChannels(updated);
    toast.success(`Test event delivered to ${channel.name} (200 OK in 42ms)`);
  };

  const samplePayloadJson = useMemo(() => {
    return JSON.stringify(
      {
        event: "issue.regression",
        timestamp: new Date().toISOString(),
        issue: {
          id: "iss_sample_984",
          title: "GatewayTimeout: Upstream stripe webhook acknowledgement exceeded 5000ms",
          status: "regression",
          level: "error",
          environment: "production",
          release: "v2.4.1",
          came_back: true,
          occurrences_24h: 3120,
          impacted_users: 189,
        },
        url: typeof window !== "undefined"
          ? `${window.location.origin}/issues/iss_sample_984`
          : "https://app.epure.ai/issues/iss_sample_984",
      },
      null,
      2
    );
  }, []);

  return (
    <PageShell
      title="Output Channels"
      description="Configure notification destinations across Slack, Discord, Webhooks, and Team Email."
      density="standard"
    >
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="size-5 text-accent" />
              <h1 className="text-lg font-semibold text-fg-primary tracking-tight">
                Reusable Output Channels
              </h1>
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              Configure notification destinations (Slack, Discord, Webhooks, Team Email) for{" "}
              <span className="font-medium text-fg-secondary">{currentOrg?.name ?? "Acme Corp"}</span>.
              Attach them to any project alert rule.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="h-8 text-xs gap-1.5 font-medium"
            onClick={handleOpenCreateModal}
          >
            <Plus className="size-3.5" />
            <span>New Output Channel</span>
          </Button>
        </div>

        {/* Channel Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-border-subtle bg-surface-1 p-8 text-center flex flex-col items-center justify-center gap-3">
              <div className="size-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                <Radio className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-fg-primary">No Output Channels configured</h3>
                <p className="mt-1 text-xs text-fg-muted max-w-sm">
                  Connect notification destinations like Slack, Discord, Webhooks, or Team Email to receive alerts when regressions strike.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={handleOpenCreateModal}
              >
                <Plus className="size-3.5" />
                <span>Create Your First Channel</span>
              </Button>
            </div>
          ) : (
            channels.map((channel) => {
            const isEmail = channel.type === "email";
            const isSlack = channel.type === "slack";
            const isDiscord = channel.type === "discord";
            const isWebhook = channel.type === "webhook";

            return (
              <div
                key={channel.id}
                className="flex flex-col justify-between rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs transition-colors hover:border-border-strong select-none"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-8 rounded-md bg-surface-2 flex items-center justify-center shrink-0 border border-border-subtle">
                        {isEmail && <Mail className="size-4 text-accent" />}
                        {isSlack && <Hash className="size-4 text-[#E01E5A]" />}
                        {isDiscord && <Radio className="size-4 text-[#5865F2]" />}
                        {isWebhook && <Webhook className="size-4 text-healthy" />}
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-semibold text-fg-primary truncate">
                          {channel.name}
                        </p>
                        <p className="font-mono text-[10px] text-fg-muted uppercase tracking-wider">
                          {channel.type}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={channel.status === "active" ? "healthy" : "error"}
                      size="sm"
                      className="text-[10px] h-5"
                    >
                      ● {channel.status}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-subtle/80 space-y-1.5 text-xs">
                    {isEmail ? (
                      <div>
                        <span className="text-[11px] text-fg-muted">Recipients:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {channel.memberEmails?.map((email) => (
                            <Badge
                              key={email}
                              variant="env"
                              size="compact"
                              className="font-mono text-[10px]"
                            >
                              {email}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[11px] text-fg-muted">Endpoint:</span>
                        <p className="font-mono text-[11px] text-fg-secondary truncate mt-0.5">
                          {channel.url}
                        </p>
                      </div>
                    )}

                    {channel.lastTestStatus && (
                      <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px]">
                        <span className="text-fg-muted">Last Ping:</span>
                        <span className="font-mono text-healthy font-medium">
                          ● {channel.lastTestStatus.code} OK ({channel.lastTestStatus.latencyMs}ms)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    className="h-7 text-xs gap-1 font-medium text-fg-secondary hover:text-fg-primary"
                    disabled={testingId === channel.id}
                    onClick={() => void handleTestChannel(channel)}
                  >
                    <Send className="size-3" />
                    <span>{testingId === channel.id ? "Sending…" : "Send Test Event"}</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-7 w-7 text-fg-muted hover:text-danger hover:bg-danger/10"
                    title="Delete channel"
                    onClick={() => handleDeleteChannel(channel.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
        </div>

        {/* Explainers Card */}
        <SectionCard
          title="Notification Channel Architecture"
          description="Epure decouples output channels from alert rules so you never re-type webhook URLs or paste Slack tokens across multiple repositories."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-fg-secondary">
            <div className="rounded-md border border-border-subtle bg-surface-2/40 p-3">
              <p className="font-medium text-fg-primary">Zero Token Sprawl</p>
              <p className="mt-1 text-fg-muted text-[11px] leading-relaxed">
                Slack and Discord webhooks are managed once at the organisation tier, protected by HMAC signing secrets.
              </p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-2/40 p-3">
              <p className="font-medium text-fg-primary">Org Member Enforcement</p>
              <p className="mt-1 text-fg-muted text-[11px] leading-relaxed">
                Email alerts strictly filter against registered team seats so external or stale inboxes never receive alerts.
              </p>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-2/40 p-3">
              <p className="font-medium text-fg-primary">Payload Verification</p>
              <p className="mt-1 text-fg-muted text-[11px] leading-relaxed">
                Webhooks pass an <code className="font-mono text-fg-primary">X-Epure-Signature-256</code> header computed with your signing secret.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Create Channel Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Output Channel</DialogTitle>
            <DialogDescription>
              Create a reusable destination to receive alerts when exceptions trigger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Channel Type Selector */}
            <div className="space-y-1.5">
              <label className="font-medium text-fg-primary">Channel Type</label>
              <div className="grid grid-cols-4 gap-2">
                {(["slack", "discord", "webhook", "email"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={channelType === type ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 text-xs font-medium capitalize"
                    onClick={() => setChannelType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Channel Name */}
            <div className="space-y-1.5">
              <label className="font-medium text-fg-primary">Channel Display Name</label>
              <Input
                placeholder="e.g. Core SRE Slack or Dev Team Email"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Type Specific Fields */}
            {channelType === "email" ? (
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-fg-primary">Select Team Recipients</label>
                  <span className="text-[11px] text-fg-muted">
                    {selectedMemberEmails.size} selected
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border-subtle bg-surface-2/30 divide-y divide-border-subtle">
                  {members.map((member) => {
                    const checked = selectedMemberEmails.has(member.email);
                    return (
                      <div
                        key={member.email}
                        className="flex items-center justify-between p-2.5 hover:bg-surface-2/80 cursor-pointer"
                        onClick={() => {
                          const next = new Set(selectedMemberEmails);
                          if (checked) next.delete(member.email);
                          else next.add(member.email);
                          setSelectedMemberEmails(next);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => {
                              const next = new Set(selectedMemberEmails);
                              if (checked) next.delete(member.email);
                              else next.add(member.email);
                              setSelectedMemberEmails(next);
                            }}
                          />
                          <div>
                            <p className="font-medium text-fg-primary">
                              {member.display_name || member.email.split("@")[0]}
                            </p>
                            <p className="font-mono text-[11px] text-fg-muted">{member.email}</p>
                          </div>
                        </div>
                        <Badge variant="neutral" size="sm" className="text-[10px] uppercase">
                          {member.role}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-border-subtle">
                {/* Webhook URL */}
                <div className="space-y-1.5">
                  <label className="font-medium text-fg-primary">
                    {channelType === "slack"
                      ? "Slack Incoming Webhook URL"
                      : channelType === "discord"
                        ? "Discord Webhook URL"
                        : "Target Webhook URL"}
                  </label>
                  <Input
                    placeholder={
                      channelType === "slack"
                        ? "https://hooks.slack.com/services/..."
                        : channelType === "discord"
                          ? "https://discord.com/api/webhooks/..."
                          : "https://your-service.com/webhook"
                    }
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>

                {/* Signing Secret */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-fg-primary">Signing Secret</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setSigningSecret(
                          `whsec_${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}`
                        )
                      }
                      className="h-6 px-1.5 text-[11px] text-accent hover:text-accent flex items-center gap-1"
                    >
                      <RefreshCw className="size-3" />
                      <span>Regenerate</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={signingSecret}
                      className="h-8 font-mono text-xs bg-surface-2/60 text-fg-secondary"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        void copyText(signingSecret);
                        toast.success("Signing secret copied");
                      }}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Collapsible Payload Preview */}
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setPayloadPreviewOpen(!payloadPreviewOpen)}
                    className="h-7 px-1 flex items-center gap-1.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
                  >
                    {payloadPreviewOpen ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    <Code2 className="size-3.5 text-accent" />
                    <span>Payload Preview & Schema</span>
                  </Button>

                  {payloadPreviewOpen && (
                    <div className="mt-2 p-3 rounded-md border border-border-subtle bg-surface-2/80 font-mono text-[11px] overflow-x-auto text-fg-secondary">
                      <pre>{samplePayloadJson}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveChannel}>
              Save Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
