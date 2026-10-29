import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Grid, GridItem } from "@polar-sh/orbit";
import { Text } from "@polar-sh/orbit/Text";
import { PageShell } from "@/components/kit/page-shell";
import { EmptyState } from "@/components/kit/empty-state";
import {
  PolarCard,
  PolarCardDescription,
  PolarCardHeader,
  PolarCardTitle,
} from "@/components/kit/polar-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Copy,
  DiscordLogo,
  DotsThree,
  EnvelopeSimple,
  Icon,
  Plus,
  SlackLogo,
  TelegramLogo,
  Trash,
  WebhooksLogo,
  X,
} from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { PROJECT_GALLERY_GRID_COLUMNS } from "@/features/org/project-list";
import { CreateOutputChannelDialog } from "@/features/org/create-output-channel-dialog";
import { copyText } from "@/lib/copy-text";
import {
  apiErrorStatus,
  deleteAlertChannel,
  fetchAlertChannels,
  fetchProjects,
  rotateWebhookSecret,
  testAlertChannel,
  type AlertChannelRow,
  type ProjectRow,
} from "@/lib/api";
import { useAppContext } from "@/shell/app-context";
import { Search } from "lucide-react";

/** @deprecated localStorage demo shape — kept for legacy imports until alert-notification-fields migrates. */
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

/** @deprecated Prefer fetchAlertChannels. */
export function getStoredChannels(): OutputChannel[] {
  return [];
}

/** @deprecated Prefer API. */
export function saveStoredChannels(_channels: OutputChannel[]): void {}

export const DEFAULT_CHANNELS: OutputChannel[] = [];

function providerIcon(provider: string) {
  switch (provider) {
    case "slack":
      return SlackLogo;
    case "discord":
      return DiscordLogo;
    case "telegram":
      return TelegramLogo;
    case "email":
      return EnvelopeSimple;
    default:
      return WebhooksLogo;
  }
}

function channelStatus(channel: AlertChannelRow): "connected" | "needs_verify" | "failing" {
  if (channel.last_test_status === "fail" || channel.last_error) return "failing";
  if (channel.is_enabled && channel.last_test_status === "ok") return "connected";
  if (!channel.is_enabled || channel.last_test_status !== "ok") return "needs_verify";
  return "connected";
}

function formatTestDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ChannelGallery({ children }: { children: ReactNode }) {
  return (
    <Grid templateColumns={PROJECT_GALLERY_GRID_COLUMNS} gap="l" width="100%">
      {children}
    </Grid>
  );
}

export function OrgChannelsPage() {
  const { user, projects: contextProjects, refreshProjects } = useAppContext();
  const canManage = user?.role === "owner" || user?.role === "admin";
  const [channels, setChannels] = useState<AlertChannelRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const projectById = useMemo(() => {
    const map = new Map<string, ProjectRow>();
    const rows = projects.length > 0 ? projects : contextProjects;
    for (const project of rows) map.set(project.id, project);
    return map;
  }, [projects, contextProjects]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [channelRows, projectRows] = await Promise.all([
        fetchAlertChannels(),
        fetchProjects(),
      ]);
      setChannels(channelRows);
      setProjects(projectRows);
      void refreshProjects().catch(() => undefined);
    } catch {
      toast.error("Could not load output channels");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [refreshProjects]);

  useEffect(() => {
    if (contextProjects.length > 0 && projects.length === 0) {
      setProjects(contextProjects);
    }
  }, [contextProjects, projects.length]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((channel) => {
      const project = projectById.get(channel.project_id);
      return (
        channel.label.toLowerCase().includes(q) ||
        channel.provider.toLowerCase().includes(q) ||
        (project?.name ?? "").toLowerCase().includes(q) ||
        (project?.slug ?? "").toLowerCase().includes(q)
      );
    });
  }, [channels, searchQuery, projectById]);

  async function handleTest(channel: AlertChannelRow) {
    setTestingId(channel.id);
    try {
      const result = await testAlertChannel(channel.id, { enable_on_ok: true });
      if (result.channel) {
        setChannels((current) =>
          current.map((row) => (row.id === channel.id ? result.channel! : row)),
        );
      } else {
        await refresh();
      }
      if (result.sent) toast.success(`Test delivered to ${channel.label}`);
      else toast.error(result.error || "Test failed");
    } catch (err) {
      toast.error(
        apiErrorStatus(err) === 429
          ? "Too many tests — try again in an hour"
          : "Test delivery failed",
      );
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(channel: AlertChannelRow) {
    setBusyId(channel.id);
    try {
      await deleteAlertChannel(channel.id);
      setChannels((current) => current.filter((row) => row.id !== channel.id));
      toast.success("Channel removed");
    } catch {
      toast.error("Could not delete channel");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotate(channel: AlertChannelRow) {
    const webhookId = channel.config?.webhook_id;
    if (!webhookId) return;
    setBusyId(channel.id);
    try {
      const rotated = await rotateWebhookSecret(webhookId);
      if (rotated.signing_secret) {
        const ok = await copyText(rotated.signing_secret);
        toast[ok ? "success" : "error"](
          ok ? "New signing secret copied" : "Secret rotated — copy failed",
        );
      } else {
        toast.success("Signing secret rotated");
      }
      await refresh();
    } catch {
      toast.error("Could not rotate secret");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageShell density="standard">
      <Box flexDirection="column" gap="l" width="100%" padding="l">
        <Grid
          templateColumns={PROJECT_GALLERY_GRID_COLUMNS}
          gap="l"
          width="100%"
          alignItems="center"
        >
          <Box alignItems="center" columnGap="s" minWidth={0} width="100%">
            <Text as="h2" variant="heading-xs">
              Output Channels
            </Text>
            {channels.length > 0 ? (
              <Badge variant="neutral" size="compact">
                {filtered.length}
                {filtered.length !== channels.length ? ` of ${channels.length}` : ""}
              </Badge>
            ) : null}
            {channels.length >= 2 ? (
              <Box flex={1} minWidth={0}>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name, provider, or project…"
                  leadingIcon={<Search size={14} />}
                />
              </Box>
            ) : null}
          </Box>

          <GridItem
            colStart={{ base: 1, sm: 2 }}
            colEnd={{ base: -1, sm: -1 }}
            justifyContent="end"
            alignItems="center"
            display="flex"
          >
            {canManage ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <Icon icon={Plus} size={14} />
                Create output channel
              </Button>
            ) : null}
          </GridItem>
        </Grid>

        {loading ? (
          <ChannelGallery>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-border-subtle bg-surface-2/60"
              />
            ))}
          </ChannelGallery>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No output channels"
            description="Connect Slack, Discord, email, or a signed webhook so alert rules can deliver."
          />
        ) : (
          <ChannelGallery>
            {filtered.map((channel) => {
              const status = channelStatus(channel);
              const project = projectById.get(channel.project_id);
              const Glyph = providerIcon(channel.provider);
              const webhookLinked = Boolean(channel.config?.webhook_id);
              const testOk = channel.last_test_status === "ok";
              const testFail =
                channel.last_test_status === "fail" || Boolean(channel.last_error);
              return (
                <PolarCard key={channel.id} variant="interactive" padding="m">
                  <Box flexDirection="column" gap="s" width="100%">
                    <PolarCardHeader>
                      <Box alignItems="start" columnGap="s" minWidth={0} flex={1}>
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2">
                          <Icon icon={Glyph} size={28} />
                        </span>
                        <Box flexDirection="column" minWidth={0} gap="xs" alignItems="start">
                          <PolarCardTitle>{channel.label}</PolarCardTitle>
                          <Badge
                            variant={
                              status === "connected"
                                ? "healthy"
                                : status === "failing"
                                  ? "error"
                                  : "neutral"
                            }
                            size="compact"
                          >
                            {status === "connected"
                              ? "Connected"
                              : status === "failing"
                                ? "Failing"
                                : "Needs verify"}
                          </Badge>
                          <PolarCardDescription>
                            {channel.provider}
                            {project ? ` · ${project.slug || project.name}` : ""}
                          </PolarCardDescription>
                        </Box>
                      </Box>
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Actions for ${channel.label}`}
                              disabled={busyId === channel.id}
                            >
                              <Icon icon={DotsThree} size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void handleTest(channel)}>
                              {testingId === channel.id ? "Testing…" : "Send test"}
                            </DropdownMenuItem>
                            {webhookLinked ? (
                              <DropdownMenuItem onClick={() => void handleRotate(channel)}>
                                <Icon icon={Copy} size={14} />
                                Rotate secret
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger"
                              onClick={() => void handleDelete(channel)}
                            >
                              <Icon icon={Trash} size={14} />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </PolarCardHeader>

                    <Box alignItems="center" columnGap="xs" width="100%">
                      {channel.last_tested_at ? (
                        <>
                          <Icon
                            icon={testOk ? Check : X}
                            size={12}
                            className={
                              testOk
                                ? "text-healthy"
                                : testFail
                                  ? "text-danger"
                                  : "text-fg-muted"
                            }
                            aria-hidden
                          />
                          <Text variant="caption" color="muted">
                            {formatTestDate(channel.last_tested_at)}
                          </Text>
                        </>
                      ) : (
                        <Text variant="caption" color="muted">
                          Not tested
                        </Text>
                      )}
                    </Box>
                  </Box>
                </PolarCard>
              );
            })}
          </ChannelGallery>
        )}

        {!canManage && channels.length === 0 && !loading ? (
          <Text variant="caption" color="muted">
            Ask an admin to connect an output channel.
          </Text>
        ) : null}
      </Box>

      <CreateOutputChannelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refresh()}
      />
    </PageShell>
  );
}
