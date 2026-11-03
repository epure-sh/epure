import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Grid, GridItem } from "@polar-sh/orbit";
import { Text } from "@polar-sh/orbit/Text";
import { PageShell } from "@/ui/block";
import { EmptyState } from "@/components/kit/empty-state";
import {
  PolarCard,
  PolarCardDescription,
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
  DiscordLogo,
  DotsThree,
  EnvelopeSimple,
  Icon,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Rocket,
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
import { EditOutputChannelDialog } from "@/features/org/edit-output-channel-dialog";
import {
  apiErrorStatus,
  deleteAlertChannel,
  fetchAlertChannels,
  fetchProjects,
  setAlertChannelEnabled,
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

function channelStatus(
  channel: AlertChannelRow,
): "connected" | "paused" | "needs_verify" | "failing" {
  if (!channel.is_enabled) return "paused";
  if (channel.last_test_status === "fail" || channel.last_error) return "failing";
  if (channel.last_test_status === "ok") return "connected";
  return "needs_verify";
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
  const [editing, setEditing] = useState<AlertChannelRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const projectById = useMemo(() => {
    const map = new Map<string, ProjectRow>();
    const rows = projects.length > 0 ? projects : contextProjects;
    for (const project of rows) map.set(project.id, project);
    return map;
  }, [projects, contextProjects]);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
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
          ? "Too many tests. Try again in an hour"
          : "Test delivery failed",
      );
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(channel: AlertChannelRow) {
    if (!window.confirm(`Delete “${channel.label}”? Alert rules using it will stop delivering.`)) {
      return;
    }
    setBusyId(channel.id);
    try {
      await deleteAlertChannel(channel.id);
      setChannels((current) => current.filter((row) => row.id !== channel.id));
      toast("Channel removed", { description: "Permanent. Recreate from Channels" });
    } catch {
      toast.error("Could not delete channel");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleEnabled(channel: AlertChannelRow) {
    const next = !channel.is_enabled;
    setBusyId(channel.id);
    try {
      const updated = await setAlertChannelEnabled(channel.id, next);
      setChannels((current) =>
        current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      );
      toast.success(next ? "Channel resumed" : "Channel paused");
    } catch {
      toast.error(next ? "Could not resume channel" : "Could not pause channel");
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
          searchQuery.trim() ? (
            <EmptyState
              tone="search"
              title="Nothing matches that filter"
              description="Try another name, provider, or project, or clear the filter to see every channel."
              actionLabel="Clear filter"
              onAction={() => setSearchQuery("")}
              hint="Filters never delete channels. They're still here."
            />
          ) : (
            <EmptyState
              tone="first-run"
              title="Ready when you are"
              description="Connect Slack, Discord, email, or a webhook so alert rules can reach your team."
              hint="One channel is enough to start. You can add more later."
              actionLabel={canManage ? "Create output channel" : undefined}
              onAction={canManage ? () => setCreateOpen(true) : undefined}
            />
          )
        ) : (
          <ChannelGallery>
            {filtered.map((channel) => {
              const status = channelStatus(channel);
              const project = projectById.get(channel.project_id);
              const Glyph = providerIcon(channel.provider);
              const testOk = channel.last_test_status === "ok";
              const testFail =
                channel.last_test_status === "fail" || Boolean(channel.last_error);
              return (
                <PolarCard key={channel.id} variant="interactive" padding="l">
                  <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3">
                    <span className="flex size-9 shrink-0 items-center justify-center text-fg-primary">
                      <Icon icon={Glyph} size={26} />
                    </span>
                    <Box flexDirection="column" minWidth={0} gap="xs" alignItems="start">
                      <Text as="h3" variant="label">
                        {channel.label}
                      </Text>
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
                            : status === "paused"
                              ? "Paused"
                              : "Needs verify"}
                      </Badge>
                    </Box>
                    <div className="justify-self-end self-start">
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-7"
                              aria-label={`Actions for ${channel.label}`}
                              disabled={busyId === channel.id}
                            >
                              <Icon icon={DotsThree} size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(channel)}>
                              <Icon icon={PencilSimple} size={14} />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleToggleEnabled(channel)}>
                              <Icon icon={channel.is_enabled ? Pause : Play} size={14} />
                              {channel.is_enabled ? "Pause" : "Resume"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleTest(channel)}>
                              <Icon icon={Rocket} size={14} />
                              {testingId === channel.id ? "Testing…" : "Send test"}
                            </DropdownMenuItem>
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
                    </div>

                    <div className="col-start-1 col-span-2 min-w-0 self-end">
                      <PolarCardDescription>
                        {channel.provider}
                        {project ? ` · ${project.slug || project.name}` : ""}
                      </PolarCardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 justify-self-end self-end whitespace-nowrap">
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
                    </div>
                  </div>
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
        onCreated={() => void refresh(true)}
      />

      <EditOutputChannelDialog
        channel={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={(updated) => {
          setChannels((current) =>
            current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
          );
        }}
      />
    </PageShell>
  );
}
