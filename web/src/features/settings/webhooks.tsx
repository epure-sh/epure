import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhooks,
  rotateWebhookSecret,
  testWebhook,
  type CreatedWebhook,
  type WebhookRow,
} from "../../lib/api";
import { formatRelativeTime } from "../../lib/format-time";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { cn } from "../../lib/cn";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
import { CopyButton } from "../../ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { useToast } from "../../ui/toast-provider";
import { InfoCallout, isValidWebhookUrl, MemberAccessNotice, SettingsTabHeader } from "./shared";

const webhookEvents = [
  {
    id: "issue_created",
    label: "New issue",
    description: "First time a fingerprint appears — matches the New issue alert.",
  },
  {
    id: "regression",
    label: "Came back",
    description: "Resolved issue returns in a newer release — matches the Came back alert.",
  },
] as const;

type WebhookEventId = (typeof webhookEvents)[number]["id"];

type DestinationId = "slack" | "discord" | "custom";

const destinations: Array<{
  id: DestinationId;
  label: string;
  format: "slack" | "discord" | "generic";
  placeholder: string;
}> = [
  {
    id: "slack",
    label: "Slack",
    format: "slack",
    placeholder: "https://hooks.slack.com/services/…",
  },
  {
    id: "discord",
    label: "Discord",
    format: "discord",
    placeholder: "https://discord.com/api/webhooks/…",
  },
  {
    id: "custom",
    label: "Custom HTTPS",
    format: "generic",
    placeholder: "https://your-service.com/epure",
  },
];

const formatOptions = [
  { value: "generic", label: "Generic JSON", hint: "Structured payload for your own service." },
  { value: "slack", label: "Slack", hint: "Incoming webhook message blocks." },
  { value: "discord", label: "Discord", hint: "Simple content string for bot webhooks." },
] as const;

function eventLabel(event: string): string {
  return webhookEvents.find((item) => item.id === event)?.label ?? event;
}

function formatLabel(format: string): string {
  return formatOptions.find((item) => item.value === format)?.label ?? format;
}

function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.length <= 12) {
      return url;
    }
    return `${parsed.origin}${path.slice(0, 8)}…${path.slice(-4)}`;
  } catch {
    return url.length > 40 ? `${url.slice(0, 28)}…` : url;
  }
}

function verificationSnippet(): string {
  return `// Verify X-Epure-Signature on incoming POSTs
const crypto = require("node:crypto");

function verifyEpureWebhook(rawBody, signatureHeader, signingSecret) {
  const key = Buffer.from(signingSecret.replace(/^whsec_/, ""), "hex");
  const expected = "sha256=" + crypto.createHmac("sha256", key).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}`;
}

function SecretRevealCard({
  webhook,
  onDismiss,
}: {
  webhook: CreatedWebhook;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader>
        <CardTitle>Copy your signing secret</CardTitle>
        <CardDescription>
          Shown once. epure signs every delivery with HMAC-SHA256 — store this on your endpoint to
          verify requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
            {webhook.signing_secret}
          </code>
          <CopyButton value={webhook.signing_secret} label="Copy secret" />
        </div>
        <p className="text-xs text-ink-muted">
          Prefix <span className="font-mono text-ink">{webhook.secret_prefix}</span> is shown in
          the list so you can tell secrets apart after rotation.
        </p>
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          I&apos;ve saved the secret
        </Button>
      </CardContent>
    </Card>
  );
}

export function WebhooksSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { user } = useAppContext();
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [destination, setDestination] = useState<DestinationId>("slack");
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"slack" | "discord" | "generic">("slack");
  const [events, setEvents] = useState<WebhookEventId[]>(["issue_created", "regression"]);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<CreatedWebhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);
  const { toast } = useToast();

  const activeProjectId = paramId ?? null;
  const canManage = user?.role === "owner" || user?.role === "admin";
  const activeDestination = destinations.find((item) => item.id === destination) ?? destinations[0];

  const loadWebhooks = useCallback(async () => {
    if (!activeProjectId || !canManage) {
      setWebhooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchWebhooks(activeProjectId);
      setWebhooks(rows);
    } catch {
      toast("Failed to load notification endpoints");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, canManage, toast]);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  function selectDestination(next: DestinationId) {
    const preset = destinations.find((item) => item.id === next) ?? destinations[0];
    setDestination(next);
    setFormat(preset.format);
    if (urlError) {
      setUrlError(null);
    }
  }

  function toggleEvent(eventId: WebhookEventId, checked: boolean) {
    setEvents((current) => {
      if (checked) {
        return current.includes(eventId) ? current : [...current, eventId];
      }
      return current.filter((value) => value !== eventId);
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId) {
      return;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Endpoint URL is required.");
      return;
    }
    if (!isValidWebhookUrl(trimmed)) {
      setUrlError("Enter a valid http or https URL.");
      return;
    }
    if (events.length === 0) {
      setUrlError("Select at least one event.");
      return;
    }

    setUrlError(null);
    setBusy(true);
    try {
      const created = await createWebhook({
        project_id: activeProjectId,
        url: trimmed,
        format,
        events: [...events],
      });
      setUrl("");
      setRevealed(created);
      await loadWebhooks();
      toast("Endpoint added — copy the signing secret");
    } catch {
      toast("Failed to add endpoint");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(id: string) {
    setBusy(true);
    try {
      await testWebhook(id);
      toast("Test delivery sent — check your endpoint");
    } catch {
      toast("Failed to send test delivery");
    } finally {
      setBusy(false);
    }
  }

  async function handleRotate(id: string) {
    if (
      !window.confirm(
        "Rotate signing secret? Your endpoint must use the new secret to verify deliveries.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const rotated = await rotateWebhookSecret(id);
      setRevealed(rotated);
      await loadWebhooks();
      toast("Signing secret rotated");
    } catch {
      toast("Failed to rotate secret");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setBusy(true);
    try {
      await deleteWebhook(deleteTarget.id);
      if (revealed?.id === deleteTarget.id) {
        setRevealed(null);
      }
      setDeleteTarget(null);
      await loadWebhooks();
      toast("Endpoint removed");
    } catch {
      toast("Failed to remove endpoint");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return <MemberAccessNotice resource="notification endpoints" />;
  }

  if (!activeProjectId) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader
          title="Notifications"
          description="Outbound webhooks for Slack, Discord, or your own HTTPS receiver."
        />
        <InfoCallout variant="warning">Select a project to manage notification endpoints.</InfoCallout>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title="Notifications"
        description="Send signed HTTP posts when new issues appear or resolved exceptions come back."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={projectPath(activeProjectId, "alerts")}>View alerts</Link>
          </Button>
        }
      />

      <InfoCallout>
        <strong className="font-medium text-ink">Outbound only.</strong> Unlike{" "}
        <Link
          to={projectSettingsPath(activeProjectId, "dsn")}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          SDK connection
        </Link>
        , webhooks are admin-only, use HMAC signing secrets, and never accept inbound traffic.
        Velocity spikes and volume milestones stay in the{" "}
        <Link
          to={projectPath(activeProjectId, "alerts")}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Alerts
        </Link>{" "}
        feed for now.
      </InfoCallout>

      {revealed ? <SecretRevealCard webhook={revealed} onDismiss={() => setRevealed(null)} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Add endpoint</CardTitle>
          <CardDescription>
            Pick a destination, paste the URL from Slack or Discord, and choose which alert types to
            forward.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Destination</p>
              <div className="flex flex-wrap gap-2">
                {destinations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectDestination(item.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors focus-ring",
                      destination === item.id
                        ? "border-accent bg-state-selected text-ink"
                        : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label="Endpoint URL"
              htmlFor="webhook-url"
              hint="Paste the incoming webhook URL from your chat app or HTTPS receiver."
              error={urlError ?? undefined}
            >
              <Input
                id="webhook-url"
                type="url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (urlError) {
                    setUrlError(null);
                  }
                }}
                placeholder={activeDestination.placeholder}
                autoComplete="off"
              />
            </Field>

            {destination === "custom" ? (
              <Field label="Payload format">
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as "slack" | "discord" | "generic")}
                >
                  <SelectTrigger aria-label="Webhook format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-ink-muted">
                  {formatOptions.find((option) => option.value === format)?.hint}
                </p>
              </Field>
            ) : (
              <p className="text-xs text-ink-muted">
                Format: <span className="font-medium text-ink">{formatLabel(format)}</span>
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Forward these alerts</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {webhookEvents.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-state-hover"
                  >
                    <Checkbox
                      checked={events.includes(item.id)}
                      onCheckedChange={(checked) => toggleEvent(item.id, checked === true)}
                      aria-label={item.label}
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium text-ink">{item.label}</span>
                      <span className="block text-xs text-ink-muted">{item.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              variant="secondary"
              disabled={busy || !url.trim() || events.length === 0}
            >
              Add endpoint
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active endpoints</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : webhooks.length === 0
                ? "No endpoints yet."
                : `${webhooks.length} signed endpoint${webhooks.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          {loading ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">Loading endpoints…</p>
          ) : webhooks.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">
              Add Slack, Discord, or a custom HTTPS receiver to get notified outside epure.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {webhooks.map((hook) => (
                <li key={hook.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate font-mono text-sm text-ink" title={hook.url}>
                        {maskWebhookUrl(hook.url)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="env">{formatLabel(hook.format)}</Badge>
                        {hook.events.map((event) => (
                          <Badge key={event} variant="secondary">
                            {eventLabel(event)}
                          </Badge>
                        ))}
                        <Badge variant="secondary" className="font-mono">
                          {hook.secret_prefix}…
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-muted">
                        Added {formatRelativeTime(hook.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleTest(hook.id)}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleRotate(hook.id)}
                      >
                        Rotate secret
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => setDeleteTarget(hook)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <details className="rounded-lg border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
          Verify signatures on your endpoint
        </summary>
        <CardContent className="space-y-3 border-t border-border pt-4">
          <p className="text-sm text-ink-muted">
            Read the raw request body, compute HMAC-SHA256 with your signing secret (strip the{" "}
            <span className="font-mono text-xs text-ink">whsec_</span> prefix), and compare to{" "}
            <span className="font-mono text-xs text-ink">X-Epure-Signature</span>.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-bg-subtle p-3 font-mono text-xs text-ink">
            {verificationSnippet()}
          </pre>
          <CopyButton value={verificationSnippet()} label="Copy sample verifier" />
        </CardContent>
      </details>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove endpoint?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `${maskWebhookUrl(deleteTarget.url)} will stop receiving events immediately.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void handleDelete()}>
              Remove endpoint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
