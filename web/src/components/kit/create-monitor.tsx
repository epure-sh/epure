import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeFrame } from "@/components/kit/code-frame";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CaretDown,
  CaretLeft,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Icon,
  Sparkle,
} from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  formatNextRunLabel,
  humanizeSchedule,
  nextRunDates,
  slugifyMonitorName,
  type IntervalUnit,
} from "@/features/monitors/schedule";
import {
  SNIPPET_TABS,
  buildSnippet,
  type SnippetPlatform,
} from "@/features/monitors/snippets";
import {
  MONITOR_TEMPLATES,
  applyTemplate,
  canAdvanceMonitor,
  canCreateMonitor,
  describeMonitorDraft,
  draftFromMonitor,
  draftToSchedule,
  emptyMonitorDraft,
  withAutoSlug,
  type CreateMonitorDraft,
  type MonitorTemplateId,
} from "./create-monitor-model";

export type { CreateMonitorDraft } from "./create-monitor-model";

export {
  emptyMonitorDraft,
  draftFromMonitor,
  draftToSchedule,
  canCreateMonitor,
  canAdvanceMonitor,
  describeMonitorDraft,
};

export interface MonitorChannelChoice {
  id: string;
  label: string;
  provider: string;
  is_enabled: boolean;
}

const ENV_OPTIONS = ["production", "staging"] as const;
const MARGIN_OPTIONS = [1, 5, 15] as const;
const RUNTIME_OPTIONS = [15, 30, 60] as const;

const FIELD_HELP = {
  grace: "How late a check-in may arrive before the run is marked missed.",
  maxRuntime: "How long a run may take before it is marked timed out.",
  failAfter: "Consecutive misses required before an issue opens.",
} as const;

function FieldHelp({ label, tip }: { label: string; tip: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`About ${label}`}
            onClick={(e) => e.preventDefault()}
          >
            ?
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface CreateMonitorPanelProps {
  step: 1 | 2 | 3;
  draft: CreateMonitorDraft;
  channels?: MonitorChannelChoice[];
  busy?: boolean;
  listening?: boolean;
  connected?: boolean;
  connectedMs?: number | null;
  createdSlug?: string | null;
  projectId?: string | null;
  /** True after the monitor row exists and step 3 shows the snippet. */
  created?: boolean;
  onChange: (next: CreateMonitorDraft) => void;
  onStep: (step: 1 | 2 | 3) => void;
  onCreate: () => void;
  onSendTest?: () => void;
  onDone?: () => void;
}

export function CreateMonitorPanel({
  step,
  draft,
  busy = false,
  listening,
  connected,
  connectedMs,
  createdSlug,
  projectId,
  created = false,
  onChange,
  onStep,
  onCreate,
  onSendTest,
  onDone,
}: CreateMonitorPanelProps) {
  const stepLabel =
    step === 1 ? "Pick a schedule" : step === 2 ? "Name it" : created ? "Connect" : "Defaults";
  const connectMode = step === 3 && created;
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentCopied, setAgentCopied] = useState(false);

  async function copyAgentPrompt() {
    if (!agentPrompt) return;
    try {
      await navigator.clipboard.writeText(agentPrompt);
      setAgentCopied(true);
      window.setTimeout(() => setAgentCopied(false), 2000);
    } catch {
      // clipboard write failed
    }
  }

  return (
    <section
      data-slot="create-monitor"
      className="flex max-h-[min(calc(100dvh-3rem),36rem)] w-full min-h-[28rem] min-w-0 flex-col overflow-hidden bg-surface-1"
      aria-label={`New monitor, step ${step} of 3`}
    >
      <header className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg-primary">New monitor</h2>
          <p className="font-mono text-2xs tabular-nums text-fg-muted">
            {step}/3 · {stepLabel}
          </p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {([1, 2, 3] as const).map((n) => (
            <span
              key={n}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors",
                n <= step ? "bg-fg-primary/70" : "bg-border-subtle",
              )}
            />
          ))}
        </div>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1 px-6 py-4",
          connectMode
            ? "flex flex-col overflow-hidden"
            : "overflow-y-auto overscroll-contain",
        )}
      >
        {step === 1 ? <TemplateStep draft={draft} onChange={onChange} /> : null}
        {step === 2 ? <SetupStep draft={draft} onChange={onChange} /> : null}
        {step === 3 ? (
          created ? (
            <ConnectStep
              draft={draft}
              createdSlug={createdSlug}
              projectId={projectId}
              listening={listening}
              connected={connected}
              connectedMs={connectedMs}
              onSendTest={onSendTest}
              onPromptChange={setAgentPrompt}
            />
          ) : (
            <DefaultsStep draft={draft} onChange={onChange} />
          )
        ) : null}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle/80 px-6 py-3.5">
        {step === 1 || (step === 3 && created) ? (
          <span />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onStep((step - 1) as 1 | 2)}
          >
            <Icon icon={CaretLeft} size={14} />
            Back
          </Button>
        )}

        {step < 3 ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !canAdvanceMonitor(step, draft)}
            onClick={() => onStep((step + 1) as 2 | 3)}
          >
            Next
            <Icon icon={CaretDown} size={14} className="-rotate-90" />
          </Button>
        ) : created ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!agentPrompt}
              onClick={() => void copyAgentPrompt()}
            >
              <Icon icon={Sparkle} size={14} />
              {agentCopied ? "Copied" : "Ask Agent"}
            </Button>
            <Button variant="primary" size="sm" onClick={onDone}>
              <Icon icon={Check} size={14} />
              Mark done
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !canCreateMonitor(draft)}
            loading={busy}
            onClick={onCreate}
          >
            <Icon icon={Check} size={14} />
            {busy ? "Creating…" : "Create"}
          </Button>
        )}
      </footer>
    </section>
  );
}

function TemplateStep({
  draft,
  onChange,
}: {
  draft: CreateMonitorDraft;
  onChange: (next: CreateMonitorDraft) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <p className="text-xs text-fg-muted">How often does this job run?</p>
      <div className="flex flex-1 flex-col gap-1.5">
        {MONITOR_TEMPLATES.map((item) => {
          const selected = draft.templateId === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className={cn(
                "h-auto flex-1 items-center justify-between gap-4 rounded-md px-4 py-3 text-left whitespace-normal",
                selected
                  ? "bg-state-hover text-fg-primary"
                  : "text-fg-secondary hover:bg-state-hover/60 hover:text-fg-primary",
              )}
              onClick={() => onChange(applyTemplate(draft, item.id as MonitorTemplateId))}
            >
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-xs font-normal text-fg-muted">{item.blurb}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function SetupStep({
  draft,
  onChange,
}: {
  draft: CreateMonitorDraft;
  onChange: (next: CreateMonitorDraft) => void;
}) {
  const schedule = useMemo(() => draftToSchedule(draft), [draft]);
  const nextRuns = useMemo(() => nextRunDates(schedule, 2), [schedule]);
  const human = humanizeSchedule(schedule);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mon-name" className="text-xs text-fg-muted">
            Name
          </Label>
          <Input
            id="mon-name"
            value={draft.name}
            placeholder="Nightly Stripe Payouts"
            autoFocus
            onChange={(e) => onChange(withAutoSlug(draft, e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mon-slug" className="text-xs text-fg-muted">
            Slug
          </Label>
          <Input
            id="mon-slug"
            value={draft.slug}
            className="font-mono"
            placeholder="nightly-stripe-payouts"
            onChange={(e) =>
              onChange({
                ...draft,
                slug: slugifyMonitorName(e.target.value) || e.target.value,
                slugTouched: true,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-x-3 gap-y-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label className="h-4 text-xs leading-4 text-fg-muted">Environment</Label>
          <Select
            value={draft.environment || "production"}
            onValueChange={(env) => onChange({ ...draft, environment: env })}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENV_OPTIONS.map((env) => (
                <SelectItem key={env} value={env}>
                  {env}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label className="h-4 text-xs leading-4 text-fg-muted">Schedule</Label>
          <div className="flex h-8 w-full gap-0.5 rounded-md bg-bg-subtle p-0.5">
            <Button
              type="button"
              size="sm"
              variant={draft.mode === "interval" ? "secondary" : "ghost"}
              className="h-full min-w-0 flex-1 px-1.5 text-xs"
              onClick={() => onChange({ ...draft, mode: "interval" })}
            >
              Interval
            </Button>
            <Button
              type="button"
              size="sm"
              variant={draft.mode === "crontab" ? "secondary" : "ghost"}
              className="h-full min-w-0 flex-1 px-1.5 text-xs"
              onClick={() => onChange({ ...draft, mode: "crontab" })}
            >
              Crontab
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label className="h-4 text-xs leading-4 text-fg-muted">
            {draft.mode === "interval" ? "Every" : "Crontab"}
          </Label>
          {draft.mode === "interval" ? (
            <div className="flex h-8 items-stretch gap-1.5">
              <Input
                type="number"
                min={1}
                className="h-8 w-14 shrink-0"
                value={draft.intervalValue}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    intervalValue: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
              <Select
                value={draft.intervalUnit}
                onValueChange={(unit) =>
                  onChange({ ...draft, intervalUnit: unit as IntervalUnit })
                }
              >
                <SelectTrigger className="h-8 min-w-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minute">minutes</SelectItem>
                  <SelectItem value="hour">hours</SelectItem>
                  <SelectItem value="day">days</SelectItem>
                  <SelectItem value="week">weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input
              value={draft.crontab}
              onChange={(e) => onChange({ ...draft, crontab: e.target.value })}
              className="h-8 font-mono"
              placeholder="0 2 * * *"
            />
          )}
        </div>
      </div>

      {draft.mode === "crontab" ? (
        <div className="space-y-2">
          <Label className="text-xs text-fg-muted">Timezone</Label>
          <Input
            value={draft.timezone}
            onChange={(e) => onChange({ ...draft, timezone: e.target.value })}
            className="font-mono sm:max-w-xs"
            placeholder="Europe/Paris"
          />
        </div>
      ) : null}

      <div className="mt-auto rounded-md bg-bg-subtle px-4 py-3">
        <p className="text-sm text-fg-primary">{human}</p>
        {nextRuns.length > 0 ? (
          <p className="mt-1.5 text-xs text-fg-muted">
            Next {nextRuns.map((d, i) => (i ? " → " : "") + formatNextRunLabel(d))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DefaultsStep({
  draft,
  onChange,
}: {
  draft: CreateMonitorDraft;
  onChange: (next: CreateMonitorDraft) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-fg-primary">Defaults</p>
        <p className="text-xs text-fg-secondary">{describeMonitorDraft(draft)}</p>
        <p className="text-xs text-fg-muted">
          Leave these unless the job is flaky or long-running.
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm text-fg-secondary">Grace</Label>
            <FieldHelp label="Grace" tip={FIELD_HELP.grace} />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {MARGIN_OPTIONS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={draft.checkinMarginMins === m ? "secondary" : "ghost"}
                onClick={() => onChange({ ...draft, checkinMarginMins: m })}
              >
                {m}m
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm text-fg-secondary">Max runtime</Label>
            <FieldHelp label="Max runtime" tip={FIELD_HELP.maxRuntime} />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {RUNTIME_OPTIONS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={draft.maxRuntimeMins === m ? "secondary" : "ghost"}
                onClick={() => onChange({ ...draft, maxRuntimeMins: m })}
              >
                {m}m
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm text-fg-secondary">Fail after</Label>
            <FieldHelp label="Fail after" tip={FIELD_HELP.failAfter} />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {[1, 2].map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={draft.failureIssueThreshold === n ? "secondary" : "ghost"}
                onClick={() => onChange({ ...draft, failureIssueThreshold: n })}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectStep({
  draft,
  createdSlug,
  projectId,
  listening,
  connected,
  connectedMs,
  onSendTest,
  onPromptChange,
}: {
  draft: CreateMonitorDraft;
  createdSlug?: string | null;
  projectId?: string | null;
  listening?: boolean;
  connected?: boolean;
  connectedMs?: number | null;
  onSendTest?: () => void;
  onPromptChange?: (prompt: string) => void;
}) {
  const [platform, setPlatform] = useState<SnippetPlatform>("node");
  const schedule = useMemo(() => draftToSchedule(draft), [draft]);
  const slug = createdSlug || draft.slug || "my-job";
  const snippet = useMemo(
    () =>
      buildSnippet(platform, {
        slug,
        schedule,
        timezone: draft.timezone,
        checkinMarginMins: draft.checkinMarginMins,
        maxRuntimeMins: draft.maxRuntimeMins,
        environment: draft.environment || "production",
        projectId,
      }),
    [platform, draft, schedule, slug, projectId],
  );
  const language = SNIPPET_TABS.find((t) => t.id === platform)?.language ?? "typescript";
  const agentPrompt = `Add this Epure cron monitor check-in to my scheduled job (slug: ${slug}):\n\n\`\`\`\n${snippet}\n\`\`\`\n\nWire upsert-on-check-in so the monitor stays in sync with the schedule.`;

  useEffect(() => {
    onPromptChange?.(agentPrompt);
  }, [agentPrompt, onPromptChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          Paste into the job ·{" "}
          <span className="font-mono text-fg-secondary">{slug}</span>
        </p>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1 text-xs",
            connected ? "bg-healthy/10 text-fg-primary" : "bg-bg-subtle text-fg-secondary",
          )}
        >
          {connected ? (
            <>
              <CheckCircle size={13} weight="fill" className="text-healthy" />
              <span>
                Live
                {connectedMs != null ? ` · ${Math.round(connectedMs)}ms` : ""}
              </span>
              <Badge variant="healthy" size="sm">
                Connected
              </Badge>
            </>
          ) : (
            <>
              <CircleNotch
                size={13}
                className={cn(listening && "animate-spin text-info")}
              />
              <span>Listening…</span>
              <Button type="button" size="xs" variant="secondary" onClick={onSendTest}>
                <Icon icon={Clock} size={12} />
                Send test
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        value={platform}
        onValueChange={(v) => setPlatform(v as SnippetPlatform)}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <TabsList className="w-full shrink-0 justify-start">
          {SNIPPET_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SNIPPET_TABS.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="mt-2 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <CodeFrame
              code={snippet}
              language={language}
              filename={`${draft.slug || "monitor"}.${tab.id}`}
              maxBodyHeight="9.5rem"
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export interface EditMonitorPanelProps {
  draft: CreateMonitorDraft;
  busy?: boolean;
  onChange: (next: CreateMonitorDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** Single-screen edit — identity, schedule, thresholds. Slug stays locked. */
export function EditMonitorPanel({
  draft,
  busy = false,
  onChange,
  onCancel,
  onSave,
}: EditMonitorPanelProps) {
  const schedule = useMemo(() => draftToSchedule(draft), [draft]);
  const nextRuns = useMemo(() => nextRunDates(schedule, 2), [schedule]);
  const human = humanizeSchedule(schedule);
  const canSave = Boolean(draft.name.trim() && draft.slug.trim());

  return (
    <section
      data-slot="edit-monitor"
      className="flex max-h-[min(calc(100dvh-3rem),34rem)] w-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-1"
      aria-label="Edit monitor"
    >
      <header className="shrink-0 px-6 pt-5 pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-fg-primary">Edit monitor</h2>
        <p className="mt-0.5 font-mono text-2xs text-fg-muted">{draft.slug}</p>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-4">
        <div className="space-y-2">
          <Label htmlFor="edit-mon-name" className="text-xs text-fg-muted">
            Name
          </Label>
          <Input
            id="edit-mon-name"
            value={draft.name}
            autoFocus
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-fg-muted">Environment</Label>
          <Select
            value={draft.environment || "production"}
            onValueChange={(env) => onChange({ ...draft, environment: env })}
          >
            <SelectTrigger className="h-8 w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENV_OPTIONS.map((env) => (
                <SelectItem key={env} value={env}>
                  {env}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-fg-muted">Schedule</Label>
            <div className="flex gap-0.5 rounded-md bg-bg-subtle p-0.5">
              <Button
                type="button"
                size="sm"
                variant={draft.mode === "interval" ? "secondary" : "ghost"}
                className="h-7"
                onClick={() => onChange({ ...draft, mode: "interval" })}
              >
                Interval
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.mode === "crontab" ? "secondary" : "ghost"}
                className="h-7"
                onClick={() => onChange({ ...draft, mode: "crontab" })}
              >
                Crontab
              </Button>
            </div>
          </div>

          {draft.mode === "interval" ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-fg-muted">Every</span>
              <Input
                type="number"
                min={1}
                className="w-24"
                value={draft.intervalValue}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    intervalValue: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
              <Select
                value={draft.intervalUnit}
                onValueChange={(unit) =>
                  onChange({ ...draft, intervalUnit: unit as IntervalUnit })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minute">minutes</SelectItem>
                  <SelectItem value="hour">hours</SelectItem>
                  <SelectItem value="day">days</SelectItem>
                  <SelectItem value="week">weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              <Input
                value={draft.crontab}
                onChange={(e) => onChange({ ...draft, crontab: e.target.value })}
                className="font-mono"
                placeholder="0 2 * * *"
              />
              <Input
                value={draft.timezone}
                onChange={(e) => onChange({ ...draft, timezone: e.target.value })}
                className="font-mono"
                placeholder="Europe/Paris"
              />
            </div>
          )}

          <div className="rounded-md bg-bg-subtle px-3.5 py-2.5">
            <p className="text-sm text-fg-primary">{human}</p>
            {nextRuns.length > 0 ? (
              <p className="mt-1 text-xs text-fg-muted">
                Next {nextRuns.map((d, i) => (i ? " → " : "") + formatNextRunLabel(d))}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 border-t border-border-subtle/80 pt-4">
          <p className="text-xs font-medium text-fg-secondary">Thresholds</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-fg-muted">Grace</Label>
              <FieldHelp label="Grace" tip={FIELD_HELP.grace} />
            </div>
            <div className="flex gap-1">
              {MARGIN_OPTIONS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="xs"
                  variant={draft.checkinMarginMins === m ? "secondary" : "ghost"}
                  onClick={() => onChange({ ...draft, checkinMarginMins: m })}
                >
                  {m}m
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-fg-muted">Max runtime</Label>
              <FieldHelp label="Max runtime" tip={FIELD_HELP.maxRuntime} />
            </div>
            <div className="flex gap-1">
              {RUNTIME_OPTIONS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="xs"
                  variant={draft.maxRuntimeMins === m ? "secondary" : "ghost"}
                  onClick={() => onChange({ ...draft, maxRuntimeMins: m })}
                >
                  {m}m
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-fg-muted">Fail after</Label>
              <FieldHelp label="Fail after" tip={FIELD_HELP.failAfter} />
            </div>
            <div className="flex gap-1">
              {[1, 2].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="xs"
                  variant={draft.failureIssueThreshold === n ? "secondary" : "ghost"}
                  onClick={() => onChange({ ...draft, failureIssueThreshold: n })}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle/80 px-6 py-3.5">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !canSave}
          loading={busy}
          onClick={onSave}
        >
          <Icon icon={Check} size={14} />
          {busy ? "Saving…" : "Save"}
        </Button>
      </footer>
    </section>
  );
}
