import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretLeft,
  Check,
  Clock,
  DiscordLogo,
  EnvelopeSimple,
  Hash,
  Icon,
  MagnifyingGlass,
  Plus,
  SlackLogo,
  TelegramLogo,
  TrendUp,
  Users,
  WarningOctagon,
  WebhooksLogo,
  X,
} from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import {
  ALERT_RULE_TEMPLATES,
  COMPARE_LABEL,
  COMPARE_OPS,
  COUNT_WINDOWS,
  COOLDOWN_COUNTS,
  COOLDOWNS,
  CONDITION_FIELDS,
  OP_LABEL,
  PAYLOAD_BLOCKS,
  SCRATCH_TEMPLATE_ID,
  TRIGGER_LABEL,
  TRIGGER_TYPES,
  USER_WINDOWS,
  canAdvance,
  defaultCondition,
  defaultTrigger,
  describeRule,
  fieldLabel,
  templateDraft,
  type AlertChannelChoice,
  type AlertCondition,
  type AlertRuleDraft,
  type AlertTrigger,
  type ChannelProvider,
  type CompareOp,
  type ConditionOp,
  type PayloadChoice,
  type TriggerType,
} from "./create-alert-rule-model";

export interface CreateAlertRulePanelProps {
  /** Create uses the 3-step wizard; edit shows one scrollable form. */
  mode?: "create" | "edit";
  step: 1 | 2 | 3;
  draft: AlertRuleDraft;
  channels?: AlertChannelChoice[];
  busy?: boolean;
  onChange: (next: AlertRuleDraft) => void;
  onStep: (step: 1 | 2 | 3) => void;
  onCreateChannel?: (input: { provider: ChannelProvider; label: string }) => Promise<AlertChannelChoice | null>;
  onSubmit?: () => void;
  submitLabel?: string;
}

export function CreateAlertRulePanel({
  mode = "create",
  step,
  draft,
  channels = [],
  busy = false,
  onChange,
  onStep,
  onCreateChannel,
  onSubmit,
  submitLabel,
}: CreateAlertRulePanelProps) {
  const editing = mode === "edit";
  const resolvedSubmit = submitLabel ?? (editing ? "Save alert" : "Create alert");
  const canSave = editing
    ? canAdvance(2, draft) && canAdvance(3, draft)
    : canAdvance(step, draft);

  return (
    <section
      data-slot="create-alert-rule"
      className={cn(
        "flex max-h-[min(calc(100dvh-3rem),36rem)] w-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-1",
      )}
      aria-label={editing ? "Edit alert" : `New alert, step ${step} of 3`}
    >
      <header className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg-primary">
            {editing ? "Edit alert" : "New alert"}
          </h2>
          <p className="font-mono text-2xs tabular-nums text-fg-muted">
            {editing ? "All fields" : `Step ${step} of 3`}
          </p>
        </div>
        {!editing ? (
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
        ) : null}
      </header>
      <div
        key={editing ? "edit" : step}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-4 animate-in fade-in duration-200"
      >
        {editing ? (
          <div className="flex flex-col gap-5">
            <SentenceStep draft={draft} onChange={onChange} compact />
            <DeliveryStep
              draft={draft}
              channels={channels}
              onChange={onChange}
              onCreateChannel={onCreateChannel}
              compact
            />
          </div>
        ) : (
          <>
            {step === 1 ? <TemplateStep draft={draft} onChange={onChange} /> : null}
            {step === 2 ? <SentenceStep draft={draft} onChange={onChange} compact /> : null}
            {step === 3 ? (
              <DeliveryStep
                draft={draft}
                channels={channels}
                onChange={onChange}
                onCreateChannel={onCreateChannel}
                compact
              />
            ) : null}
          </>
        )}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle/80 px-6 py-3.5">
        {editing || step === 1 ? (
          <span />
        ) : (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onStep((step - 1) as 1 | 2)}>
            <Icon icon={CaretLeft} size={14} />
            Back
          </Button>
        )}
        {editing || step === 3 ? (
          <Button variant="primary" size="sm" disabled={busy || !canSave} onClick={onSubmit}>
            <Icon icon={Check} size={14} />
            {busy ? "Saving…" : resolvedSubmit}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !canAdvance(step, draft)}
            onClick={() => onStep((step + 1) as 2 | 3)}
          >
            Next
            <Icon icon={CaretDown} size={14} className="-rotate-90" />
          </Button>
        )}
      </footer>
    </section>
  );
}

const TEMPLATE_ICON: Record<string, typeof WarningOctagon> = {
  "production-crash": WarningOctagon,
  "regression-watchdog": ArrowCounterClockwise,
  "error-spike": TrendUp,
  "many-users": Users,
  "critical-routes": Hash,
};

function TemplateStep({
  draft,
  onChange,
}: {
  draft: AlertRuleDraft;
  onChange: (next: AlertRuleDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-secondary">Choose a template to start from</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ALERT_RULE_TEMPLATES.map((item) => {
          const selected = draft.templateId === item.id;
          return (
            <Button
              key={item.id}
              variant="outline"
              className={cn(
                "relative h-auto min-h-0 w-full flex-col items-start gap-2 whitespace-normal rounded-md! border-2! border-border-subtle px-4 py-3.5 pb-8 text-left",
                "hover:border-border-strong hover:bg-surface-2",
                selected && "border-border-strong! bg-surface-2",
              )}
              aria-pressed={selected}
              onClick={() => onChange(templateDraft(item.id))}
            >
              {selected ? (
                <Icon icon={Check} size={14} className="absolute bottom-2.5 right-2.5 text-fg-primary" />
              ) : null}
              <span className="flex w-full flex-col items-start gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Icon icon={TEMPLATE_ICON[item.id] ?? Plus} size={14} className="shrink-0 text-fg-secondary" />
                  <span className="text-[13px] font-medium leading-tight text-fg-primary">{item.title}</span>
                </span>
                <span className="text-[11px] font-normal leading-snug text-fg-muted">{item.detail}</span>
              </span>
            </Button>
          );
        })}
        <Button
          variant="outline"
          className={cn(
            "relative h-auto min-h-0 w-full flex-col items-start gap-2 whitespace-normal rounded-md! border-2! border-border-subtle px-4 py-3.5 pb-8 text-left",
            "hover:border-border-strong hover:bg-surface-2",
            draft.templateId === SCRATCH_TEMPLATE_ID && "border-border-strong! bg-surface-2",
          )}
          aria-pressed={draft.templateId === SCRATCH_TEMPLATE_ID}
          onClick={() => onChange(templateDraft(SCRATCH_TEMPLATE_ID))}
        >
          {draft.templateId === SCRATCH_TEMPLATE_ID ? (
            <Icon icon={Check} size={14} className="absolute bottom-2.5 right-2.5 text-fg-primary" />
          ) : null}
          <span className="flex w-full flex-col items-start gap-1.5">
            <span className="flex items-center gap-1.5">
              <Icon icon={Plus} size={14} className="shrink-0 text-fg-secondary" />
              <span className="text-[13px] font-medium leading-tight text-fg-primary">Start blank</span>
            </span>
            <span className="text-[11px] font-normal leading-snug text-fg-muted">Build your own rule</span>
          </span>
        </Button>
      </div>
    </div>
  );
}

function SentenceStep({
  draft,
  onChange,
  compact = false,
}: {
  draft: AlertRuleDraft;
  onChange: (next: AlertRuleDraft) => void;
  compact?: boolean;
}) {
  const controlSize = compact ? "sm" : "md";

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-5")}>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-secondary">Name</span>
        <Input
          size={controlSize}
          value={draft.name}
          placeholder="Prod crash"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-secondary">Description</span>
        <Input
          size={controlSize}
          value={draft.description}
          placeholder="Optional note for this alert"
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>
      <RuleSection title="When" hint="(any of these happens)">
        <div className="flex flex-col gap-1.5">
          {draft.triggers.map((trigger, index) => (
            <div
              key={`${trigger.type}-${index}`}
              className="flex flex-nowrap items-center gap-1.5"
            >
              <Icon icon={TRIGGER_ICON[trigger.type]} size={14} className="shrink-0 text-fg-secondary" />
              <Select
                value={trigger.type}
                onValueChange={(value) => {
                  const next = draft.triggers.slice();
                  next[index] = defaultTrigger(value as TriggerType);
                  onChange({ ...draft, triggers: next });
                }}
              >
                <SelectTrigger size="sm" className="w-fit shrink-0 whitespace-nowrap" aria-label="Trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TRIGGER_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TriggerExtras
                compact
                trigger={trigger}
                onChange={(next) => {
                  const triggers = draft.triggers.slice();
                  triggers[index] = next;
                  onChange({ ...draft, triggers });
                }}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                aria-label="Remove trigger"
                onClick={() => onChange({ ...draft, triggers: draft.triggers.filter((_, i) => i !== index) })}
              >
                <Icon icon={X} size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...draft, triggers: [...draft.triggers, nextTrigger(draft.triggers)] })}
          >
            <Icon icon={Plus} size={14} />
            Add trigger
          </Button>
        </div>
      </RuleSection>
      <RuleSection
        title="If"
        hint={draft.match === "all" ? "(all of these)" : "(any of these)"}
        extra={
          <Select
            value={draft.match}
            onValueChange={(value) => onChange({ ...draft, match: value === "any" ? "any" : "all" })}
          >
            <SelectTrigger size="sm" className="w-fit" aria-label="Condition match">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="flex flex-col gap-1.5">
          {draft.conditions.map((condition, index) => (
            <ConditionRow
              key={`${condition.field}-${index}`}
              compact={compact}
              condition={condition}
              onChange={(next) => {
                const conditions = draft.conditions.slice();
                conditions[index] = next;
                onChange({ ...draft, conditions });
              }}
              onRemove={() =>
                onChange({ ...draft, conditions: draft.conditions.filter((_, i) => i !== index) })
              }
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange({ ...draft, conditions: [...draft.conditions, defaultCondition()] })}
          >
            <Icon icon={Plus} size={14} />
            Add condition
          </Button>
        </div>
      </RuleSection>
      <div className="flex flex-wrap items-center gap-2 py-0.5">
        <Icon icon={Clock} size={14} className="text-fg-muted" />
        <span className="text-xs text-fg-primary">Triggered at most</span>
        <Select
          value={String(draft.cooldownCount)}
          onValueChange={(value) => onChange({ ...draft, cooldownCount: Number(value) })}
        >
          <SelectTrigger size={controlSize} className="w-16" aria-label="Max times">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COOLDOWN_COUNTS.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-fg-primary">{draft.cooldownCount === 1 ? "time" : "times"} per</span>
        <Select
          value={String(draft.cooldownMins)}
          onValueChange={(value) => onChange({ ...draft, cooldownMins: Number(value) })}
        >
          <SelectTrigger size={controlSize} className="w-28" aria-label="Window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COOLDOWNS.map((item) => (
              <SelectItem key={item.mins} value={String(item.mins)}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-fg-secondary">{describeRule(draft)}</p>
    </div>
  );
}

const TRIGGER_ICON = {
  issue_new: WarningOctagon,
  issue_count: TrendUp,
  users_affected: Users,
} as const;

function nextTrigger(existing: AlertTrigger[]): AlertTrigger {
  const used = new Set(existing.map((item) => item.type));
  const type = TRIGGER_TYPES.find((item) => !used.has(item)) ?? "issue_count";
  return defaultTrigger(type);
}

function TriggerExtras({
  trigger,
  onChange,
  compact = false,
}: {
  trigger: AlertTrigger;
  onChange: (next: AlertTrigger) => void;
  compact?: boolean;
}) {
  if (trigger.type !== "issue_count" && trigger.type !== "users_affected") return null;
  const windows = trigger.type === "users_affected" ? USER_WINDOWS : COUNT_WINDOWS;
  const size = compact ? "sm" : "md";
  return (
    <>
      <Select
        value={trigger.op}
        onValueChange={(op) => onChange({ ...trigger, op: op as CompareOp })}
      >
        <SelectTrigger size={size} className="w-fit shrink-0 whitespace-nowrap px-2" aria-label="Comparison">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPARE_OPS.map((op) => (
            <SelectItem key={op} value={op} className="justify-center">
              {COMPARE_LABEL[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Orbit Input wraps in flex-1 — pin width so it can't open a gap in the row. */}
      <span className="inline-flex w-14 shrink-0 [&>div]:w-full [&>div]:flex-none">
        <Input
          size={size}
          className="w-full tabular-nums"
          inputMode="numeric"
          aria-label="Number"
          value={String(trigger.threshold)}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^\d]/g, "");
            const threshold = raw === "" ? 0 : Number(raw);
            onChange({ ...trigger, threshold });
          }}
        />
      </span>
      <span className="shrink-0 text-xs text-fg-secondary">in</span>
      <Select
        value={trigger.window}
        onValueChange={(window) => onChange({ ...trigger, window } as AlertTrigger)}
      >
        <SelectTrigger size={size} className="w-fit shrink-0 whitespace-nowrap" aria-label="Time">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {windows.map((window) => (
            <SelectItem key={window.id} value={window.id}>
              {window.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  compact = false,
}: {
  condition: AlertCondition;
  onChange: (next: AlertCondition) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  const fields = CONDITION_FIELDS;
  const spec = fields.find((item) => item.field === condition.field) ?? CONDITION_FIELDS[0];
  const hideValue = condition.op === "exists" || condition.op === "is_not_null";
  const size = compact ? "sm" : "md";
  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <Select
        value={condition.field}
        onValueChange={(field) => onChange(defaultCondition(field))}
      >
        <SelectTrigger size={size} className="w-fit shrink-0 whitespace-nowrap" aria-label="Field">
          <SelectValue placeholder={fieldLabel(condition.field)} />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.field} value={field.field}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={condition.op}
        onValueChange={(op) => onChange({ ...condition, op: op as ConditionOp })}
      >
        <SelectTrigger size={size} className="w-fit shrink-0 whitespace-nowrap" aria-label="Operator">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {spec.ops.map((op) => (
            <SelectItem key={op} value={op}>
              {OP_LABEL[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hideValue ? null : spec.values ? (
        <Select value={condition.value} onValueChange={(value) => onChange({ ...condition, value })}>
          <SelectTrigger size="sm" className="w-fit shrink-0 whitespace-nowrap" aria-label="Value">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {spec.values.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="inline-flex w-28 shrink-0 [&>div]:w-full [&>div]:flex-none">
          <Input
            size="sm"
            className="w-full"
            aria-label="Value"
            value={condition.value}
            onChange={(event) => onChange({ ...condition, value: event.target.value })}
          />
        </span>
      )}
      <Button variant="ghost" size="icon-xs" className="shrink-0" aria-label="Remove condition" onClick={onRemove}>
        <Icon icon={X} size={14} />
      </Button>
    </div>
  );
}

function DeliveryStep({
  draft,
  channels,
  onChange,
  onCreateChannel,
  compact = false,
}: {
  draft: AlertRuleDraft;
  channels: AlertChannelChoice[];
  onChange: (next: AlertRuleDraft) => void;
  onCreateChannel?: CreateAlertRulePanelProps["onCreateChannel"];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<ChannelProvider>("slack");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const needle = query.trim().toLowerCase();
  const selected = channels.filter((channel) => draft.channelIds.includes(channel.id));
  const matches = channels.filter((channel) => {
    if (draft.channelIds.includes(channel.id) || !channel.enabled) return false;
    if (!needle) return true;
    return `${providerName(channel.provider)} ${channel.label}`.toLowerCase().includes(needle);
  });
  const size = compact ? "sm" : "md";

  function addChannel(id: string) {
    if (draft.channelIds.includes(id)) return;
    onChange({ ...draft, channelIds: [...draft.channelIds, id] });
    setQuery("");
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-fg-secondary">Output</p>
          <Button variant="ghost" size="sm" onClick={() => setCreating((value) => !value)}>
            Create channel
          </Button>
        </div>
        <div
          className={cn(
            "flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-1 px-2 py-1.5 focus-within:border-border-strong",
            !compact && "rounded-2xl px-3 py-2",
          )}
        >
          <div className="flex w-full items-center gap-1.5">
            <Icon icon={MagnifyingGlass} size={compact ? 14 : 18} className="shrink-0 text-fg-muted" />
            <Input
              size="auto"
              variant="ghost"
              value={query}
              placeholder="Search channels"
              className={cn(
                "w-full min-w-0 flex-1 border-0! bg-transparent! px-1 shadow-none! ring-0! focus:ring-0!",
                compact ? "h-8 text-sm" : "h-10 text-base",
              )}
              onFocus={() => setListOpen(true)}
              onBlur={() => setListOpen(false)}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {selected.length > 0 ? (
            <div className="flex w-full flex-wrap justify-end gap-1.5">
              {selected.map((channel) => (
                <Badge
                  key={channel.id}
                  size="sm"
                  className={cn(
                    "shrink-0 gap-1.5 whitespace-nowrap",
                    !compact && "h-9 gap-2 px-3 text-base",
                  )}
                >
                  <Icon icon={channelIcon(channel.provider)} size={compact ? 14 : 18} className="shrink-0" />
                  <span className="whitespace-nowrap">{channel.label}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${channel.label}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      onChange({
                        ...draft,
                        channelIds: draft.channelIds.filter((id) => id !== channel.id),
                      })
                    }
                  >
                    <Icon icon={X} size={12} />
                  </Button>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {listOpen ? (
          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 p-1">
            {matches.map((channel) => (
              <Button
                key={channel.id}
                variant="ghost"
                size="sm"
                className="w-fit justify-start gap-2 px-2"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addChannel(channel.id)}
              >
                <Icon icon={channelIcon(channel.provider)} size={16} />
                {providerName(channel.provider)} · {channel.label}
              </Button>
            ))}
            {matches.length === 0 ? (
              <p className="px-2 py-2 text-xs text-fg-muted">No channel matches.</p>
            ) : null}
          </div>
        ) : null}
        {creating ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-border-subtle p-2">
            <Select value={provider} onValueChange={(value) => setProvider(value as ChannelProvider)}>
              <SelectTrigger size={size} className="w-28" aria-label="Provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["slack", "discord", "telegram", "email", "webhook"] as const).map((item) => (
                  <SelectItem key={item} value={item}>
                    {providerName(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              size={size}
              className="min-w-32 flex-1"
              placeholder="Name"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!onCreateChannel || label.trim().length === 0 || saving}
              onClick={() => {
                if (!onCreateChannel) return;
                setSaving(true);
                void onCreateChannel({ provider, label: label.trim() })
                  .then((created) => {
                    if (!created) return;
                    onChange({ ...draft, channelIds: [...draft.channelIds, created.id] });
                    setLabel("");
                    setCreating(false);
                  })
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving…" : "Add"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-fg-secondary">
          Alerts include when they fired, why, matched conditions, issue, events, users, environment, and release.
        </p>
        <ul className="flex flex-col">
          {PAYLOAD_BLOCKS.map((block) => (
            <PayloadRow
              key={block.id}
              block={block}
              payload={draft.payload}
              onChange={(payload) => onChange({ ...draft, payload })}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function PayloadRow({
  block,
  payload,
  onChange,
}: {
  block: (typeof PAYLOAD_BLOCKS)[number];
  payload: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const [open, setOpen] = useState(false);
  const children = block.children ?? [];
  const checked = blockChecked(children, payload, block.id);

  function toggle(next: boolean) {
    const copy = { ...payload, [block.id]: next };
    const seen = new Set<string>();
    for (const child of children) {
      if (!child.group) {
        copy[child.id] = next;
        continue;
      }
      if (!next) {
        copy[child.id] = false;
        continue;
      }
      if (seen.has(child.group)) continue;
      const members = children.filter((item) => item.group === child.group);
      const pick = members.find((item) => item.default) ?? members[0];
      for (const member of members) copy[member.id] = member.id === pick.id;
      seen.add(child.group);
    }
    onChange(copy);
  }

  return (
    <li className="border-b border-border-subtle py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={checked}
          aria-label={block.label}
          onCheckedChange={(value) => toggle(value === true)}
        />
        {children.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-between"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="text-sm text-fg-primary">{block.label}</span>
            <Icon
              icon={CaretDown}
              size={14}
              className={cn("text-fg-muted transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}
            />
          </Button>
        ) : (
          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
            <span className="text-sm text-fg-primary">{block.label}</span>
            <span className="truncate text-xs text-fg-muted">{block.detail}</span>
          </span>
        )}
      </div>
      {open && children.length > 0 ? (
        <div className="flex flex-col gap-2 py-2 pl-8">
          <p className="text-xs leading-relaxed text-fg-muted">{block.detail}</p>
          <PayloadOptions blockId={block.id} children={children} payload={payload} onChange={onChange} />
        </div>
      ) : null}
    </li>
  );
}

function PayloadOptions({
  blockId,
  children,
  payload,
  onChange,
}: {
  blockId: string;
  children: PayloadChoice[];
  payload: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const seen = new Set<string>();
  return (
    <>
      {children.map((child) => {
        if (child.group) {
          if (seen.has(child.group)) return null;
          seen.add(child.group);
          const members = children.filter((item) => item.group === child.group);
          const selected =
            members.find((item) => payload[item.id])?.id ??
            members.find((item) => item.default)?.id ??
            members[0].id;
          return (
            <div key={child.group} className="flex items-center gap-2">
              <span className="text-sm text-fg-secondary">{child.groupLabel ?? "Choice"}</span>
              <Select
                value={selected}
                onValueChange={(id) => {
                  const copy = { ...payload, [blockId]: true };
                  for (const member of members) copy[member.id] = member.id === id;
                  onChange(copy);
                }}
              >
                <SelectTrigger size="sm" className="w-28" aria-label={child.groupLabel ?? "Choice"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        return (
          <label key={child.id} className="flex items-center gap-2 text-sm text-fg-primary">
            <Checkbox
              checked={Boolean(payload[child.id])}
              aria-label={child.label}
              onCheckedChange={(value) => onChange({ ...payload, [blockId]: true, [child.id]: value === true })}
            />
            {child.label}
          </label>
        );
      })}
    </>
  );
}

function blockChecked(
  children: PayloadChoice[],
  payload: Record<string, boolean>,
  blockId: string,
): boolean | "indeterminate" {
  if (children.length === 0) return Boolean(payload[blockId]);
  const groups = new Map<string, PayloadChoice[]>();
  const boxes: PayloadChoice[] = [];
  for (const child of children) {
    if (child.group) {
      const list = groups.get(child.group) ?? [];
      list.push(child);
      groups.set(child.group, list);
    } else {
      boxes.push(child);
    }
  }
  const boxesOn = boxes.filter((item) => payload[item.id]).length;
  const groupsOn = [...groups.values()].filter((members) => members.some((item) => payload[item.id])).length;
  if (boxesOn === boxes.length && groupsOn === groups.size) return true;
  if (boxesOn === 0 && groupsOn === 0) return false;
  return "indeterminate";
}

function channelIcon(provider: ChannelProvider) {
  switch (provider) {
    case "slack":
      return SlackLogo;
    case "discord":
      return DiscordLogo;
    case "telegram":
      return TelegramLogo;
    case "email":
      return EnvelopeSimple;
    case "webhook":
      return WebhooksLogo;
  }
}

function RuleSection({
  title,
  hint,
  extra,
  children,
}: {
  title: string;
  hint: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-control border border-border-subtle">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 flex-1 justify-start"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon
            icon={CaretDown}
            size={12}
            className={cn("text-fg-muted transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">{title}</span>
          <span className="truncate text-[10px] font-normal text-fg-muted">{hint}</span>
        </Button>
        {extra}
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="px-2 pb-2">{children}</div>
        </div>
      </div>
    </section>
  );
}

function providerName(provider: ChannelProvider): string {
  switch (provider) {
    case "slack":
      return "Slack";
    case "discord":
      return "Discord";
    case "telegram":
      return "Telegram";
    case "email":
      return "Email";
    case "webhook":
      return "Webhook";
  }
}
