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
  ADVANCED_TRIGGERS,
  ALERT_RULE_TEMPLATES,
  BASE_FIELDS,
  BASE_TRIGGERS,
  COOLDOWN_COUNTS,
  COOLDOWNS,
  CONDITION_FIELDS,
  OP_LABEL,
  PAYLOAD_BLOCKS,
  SCRATCH_TEMPLATE_ID,
  TRIGGER_LABEL,
  canAdvance,
  defaultCondition,
  defaultTrigger,
  describeRule,
  fieldLabel,
  needsAdvanced,
  templateDraft,
  type AlertChannelChoice,
  type AlertCondition,
  type AlertRuleDraft,
  type AlertTrigger,
  type ChannelProvider,
  type ConditionOp,
  type TriggerType,
} from "./create-alert-rule-model";

export interface CreateAlertRulePanelProps {
  step: 1 | 2 | 3;
  draft: AlertRuleDraft;
  channels?: AlertChannelChoice[];
  busy?: boolean;
  onChange: (next: AlertRuleDraft) => void;
  onStep: (step: 1 | 2 | 3) => void;
  onCreateChannel?: (input: { provider: ChannelProvider; label: string }) => Promise<AlertChannelChoice | null>;
  onSubmit?: () => void;
}

export function CreateAlertRulePanel({
  step,
  draft,
  channels = [],
  busy = false,
  onChange,
  onStep,
  onCreateChannel,
  onSubmit,
}: CreateAlertRulePanelProps) {
  return (
    <section
      data-slot="create-alert-rule"
      className="flex w-full min-w-0 flex-col rounded-panel border border-border-subtle bg-surface-1"
      aria-label={`New alert, step ${step} of 3`}
    >
      <header className="border-b border-border-subtle px-5 py-5">
        <h2 className="text-xl font-semibold tracking-tight text-fg-primary">New alert</h2>
        <p className="mt-1 text-sm text-fg-muted">Step {step} of 3</p>
      </header>
      <div
        key={step}
        className="animate-in fade-in slide-in-from-right-2 px-5 py-5 duration-300"
      >
        {step === 1 ? <TemplateStep draft={draft} onChange={onChange} /> : null}
        {step === 2 ? <SentenceStep draft={draft} onChange={onChange} /> : null}
        {step === 3 ? (
          <DeliveryStep
            draft={draft}
            channels={channels}
            onChange={onChange}
            onCreateChannel={onCreateChannel}
          />
        ) : null}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-4">
        {step > 1 ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onStep((step - 1) as 1 | 2)}>
            <Icon icon={CaretLeft} size={14} />
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !canAdvance(step, draft)}
            onClick={() => onStep((step + 1) as 2 | 3)}
          >
            Next
            <Icon icon={CaretDown} size={14} className="-rotate-90" />
          </Button>
        ) : (
          <Button variant="primary" size="sm" disabled={busy || !canAdvance(3, draft)} onClick={onSubmit}>
            <Icon icon={Check} size={14} />
            {busy ? "Saving…" : "Create alert"}
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">Pick a starting point</p>
      <div className="grid grid-cols-3 gap-3">
        {ALERT_RULE_TEMPLATES.map((item) => {
          const selected = draft.templateId === item.id;
          return (
            <Button
              key={item.id}
              variant={selected ? "secondary" : "outline"}
              className="aspect-square h-auto flex-col items-start justify-between whitespace-normal p-4 text-left"
              aria-pressed={selected}
              onClick={() => onChange(templateDraft(item.id))}
            >
              <Icon icon={TEMPLATE_ICON[item.id] ?? Plus} size={22} className="text-fg-secondary" />
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-fg-primary">
                  {item.title}
                  {item.recommended ? (
                    <Badge size="compact" variant="info">
                      Recommended
                    </Badge>
                  ) : null}
                </span>
                <span className="text-xs font-normal text-fg-muted">{item.detail}</span>
              </span>
            </Button>
          );
        })}
        <Button
          variant={draft.templateId === SCRATCH_TEMPLATE_ID ? "secondary" : "outline"}
          className="aspect-square h-auto flex-col items-start justify-between whitespace-normal p-4 text-left"
          aria-pressed={draft.templateId === SCRATCH_TEMPLATE_ID}
          onClick={() => onChange(templateDraft(SCRATCH_TEMPLATE_ID))}
        >
          <Icon icon={Plus} size={22} className="text-fg-secondary" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-fg-primary">Blank</span>
            <span className="text-xs font-normal text-fg-muted">Empty rule</span>
          </span>
        </Button>
      </div>
    </div>
  );
}

function SentenceStep({
  draft,
  onChange,
}: {
  draft: AlertRuleDraft;
  onChange: (next: AlertRuleDraft) => void;
}) {
  const [advanced, setAdvanced] = useState(
    () => draft.templateId === SCRATCH_TEMPLATE_ID || needsAdvanced(draft),
  );
  const triggerChoices =
    draft.templateId === SCRATCH_TEMPLATE_ID || advanced
      ? [...BASE_TRIGGERS, ...ADVANCED_TRIGGERS]
      : BASE_TRIGGERS;

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm text-fg-secondary">Name</span>
        <Input
          size="md"
          value={draft.name}
          placeholder="Prod crash"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <RuleSection title="When" hint="Any of these">
        <div className="flex flex-col gap-2">
          {draft.triggers.map((trigger, index) => (
            <div key={`${trigger.type}-${index}`} className="flex items-center gap-2">
              <Select
                value={trigger.type}
                onValueChange={(value) => {
                  const next = draft.triggers.slice();
                  next[index] = defaultTrigger(value as TriggerType);
                  onChange({ ...draft, triggers: next });
                }}
              >
                <SelectTrigger size="md" className="min-w-0 flex-1" aria-label="Trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(triggerChoices.includes(trigger.type) ? triggerChoices : [trigger.type, ...triggerChoices]).map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        {TRIGGER_LABEL[type]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <TriggerExtras
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
            onClick={() => onChange({ ...draft, triggers: [...draft.triggers, defaultTrigger("issue_new")] })}
          >
            <Icon icon={Plus} size={14} />
            Add trigger
          </Button>
        </div>
      </RuleSection>
      <RuleSection
        title="If"
        hint={draft.match === "all" ? "All of these" : "Any of these"}
        extra={
          <Select
            value={draft.match}
            onValueChange={(value) => onChange({ ...draft, match: value === "any" ? "any" : "all" })}
          >
            <SelectTrigger size="sm" className="w-24" aria-label="Condition match">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="flex flex-col gap-2">
          {draft.conditions.map((condition, index) => (
            <ConditionRow
              key={`${condition.field}-${index}`}
              advanced={advanced}
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
      <div className="flex flex-wrap items-center gap-3 py-1">
        <Icon icon={Clock} size={16} className="text-fg-muted" />
        <span className="text-sm text-fg-primary">Triggered at most</span>
        <Select
          value={String(draft.cooldownCount)}
          onValueChange={(value) => onChange({ ...draft, cooldownCount: Number(value) })}
        >
          <SelectTrigger size="md" className="w-20" aria-label="Max times">
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
        <span className="text-sm text-fg-primary">{draft.cooldownCount === 1 ? "time" : "times"} per</span>
        <Select
          value={String(draft.cooldownMins)}
          onValueChange={(value) => onChange({ ...draft, cooldownMins: Number(value) })}
        >
          <SelectTrigger size="md" className="w-32" aria-label="Window">
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
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
          <Icon icon={CaretDown} size={14} className={cn("transition-transform duration-200", advanced ? "rotate-0" : "-rotate-90")} />
          Advanced
        </Button>
        <p className="text-xs leading-relaxed text-fg-muted">
          Counts, routes, and tags. Environment, level, unhandled, and priority stay above.
        </p>
      </div>
      <p className="text-sm text-fg-secondary">{describeRule(draft)}</p>
    </div>
  );
}

function TriggerExtras({
  trigger,
  onChange,
}: {
  trigger: AlertTrigger;
  onChange: (next: AlertTrigger) => void;
}) {
  if (trigger.type !== "project_count" && trigger.type !== "issue_count" && trigger.type !== "users_affected") {
    return null;
  }
  const windows = trigger.type === "users_affected" ? ["1h", "24h", "total"] : ["1m", "5m", "15m", "1h", "24h"];
  return (
    <>
      <Input
        size="sm"
        className="w-16"
        inputMode="numeric"
        aria-label="Threshold"
        value={String(trigger.threshold)}
        onChange={(event) => {
          const threshold = Number(event.target.value.replace(/[^\d]/g, "")) || 1;
          onChange({ ...trigger, threshold });
        }}
      />
      <Select value={trigger.window} onValueChange={(window) => onChange({ ...trigger, window } as AlertTrigger)}>
        <SelectTrigger size="sm" className="w-20" aria-label="Window">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {windows.map((window) => (
            <SelectItem key={window} value={window}>
              {window}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function ConditionRow({
  advanced,
  condition,
  onChange,
  onRemove,
}: {
  advanced: boolean;
  condition: AlertCondition;
  onChange: (next: AlertCondition) => void;
  onRemove: () => void;
}) {
  const fields = CONDITION_FIELDS.filter(
    (item) => advanced || BASE_FIELDS.includes(item.field as (typeof BASE_FIELDS)[number]) || item.field === condition.field,
  );
  const spec = fields.find((item) => item.field === condition.field) ?? CONDITION_FIELDS[0];
  const hideValue = condition.op === "exists" || condition.op === "is_not_null";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={condition.field}
        onValueChange={(field) => onChange(defaultCondition(field))}
      >
        <SelectTrigger size="md" className="min-w-0 flex-1" aria-label="Field">
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
        <SelectTrigger size="sm" className="w-32" aria-label="Operator">
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
          <SelectTrigger size="sm" className="w-32" aria-label="Value">
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
        <Input
          size="sm"
          className="w-36"
          aria-label="Value"
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        />
      )}
      <Button variant="ghost" size="icon-xs" aria-label="Remove condition" onClick={onRemove}>
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
}: {
  draft: AlertRuleDraft;
  channels: AlertChannelChoice[];
  onChange: (next: AlertRuleDraft) => void;
  onCreateChannel?: CreateAlertRulePanelProps["onCreateChannel"];
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<ChannelProvider>("slack");
  const [label, setLabel] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const needle = query.trim().toLowerCase();
  const selected = channels.filter((channel) => draft.channelIds.includes(channel.id));
  const matches = channels.filter((channel) => {
    if (draft.channelIds.includes(channel.id) || !channel.enabled) return false;
    if (!needle) return true;
    return `${providerName(channel.provider)} ${channel.label}`.toLowerCase().includes(needle);
  });

  function addChannel(id: string) {
    if (draft.channelIds.includes(id)) return;
    onChange({ ...draft, channelIds: [...draft.channelIds, id] });
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-fg-secondary">Output</p>
          <Button variant="ghost" size="sm" onClick={() => setCreating((value) => !value)}>
            Create output channel
          </Button>
        </div>
        <Input
          size="md"
          value={query}
          placeholder="Search channels"
          leadingIcon={<Icon icon={MagnifyingGlass} size={15} />}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-col gap-1">
          {matches.map((channel) => (
            <Button
              key={channel.id}
              variant="ghost"
              size="md"
              className="h-10 justify-start gap-2"
              onClick={() => addChannel(channel.id)}
            >
              <Icon icon={channelIcon(channel.provider)} size={18} />
              {providerName(channel.provider)} · {channel.label}
            </Button>
          ))}
          {needle && matches.length === 0 ? (
            <p className="px-1 text-xs text-fg-muted">No channel matches.</p>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((channel) => (
              <Badge key={channel.id} size="md" className="h-9 gap-2 px-2 text-sm">
                <Icon icon={channelIcon(channel.provider)} size={18} />
                {channel.label}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${channel.label}`}
                  onClick={() =>
                    onChange({
                      ...draft,
                      channelIds: draft.channelIds.filter((id) => id !== channel.id),
                    })
                  }
                >
                  <Icon icon={X} size={14} />
                </Button>
              </Badge>
            ))}
          </div>
        ) : null}
        {creating ? (
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-border-subtle p-3">
            <Select value={provider} onValueChange={(value) => setProvider(value as ChannelProvider)}>
              <SelectTrigger size="md" className="w-36" aria-label="Provider">
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
              size="md"
              className="min-w-40 flex-1"
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

      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-fg-secondary">
          Every alert shows when it fired, why, the conditions that matched, the issue, events, users, environment, and release.
        </p>
        <ul className="flex flex-col">
          {PAYLOAD_BLOCKS.filter((block) => !block.advanced).map((block) => (
            <PayloadRow
              key={block.id}
              block={block}
              payload={draft.payload}
              onChange={(payload) => onChange({ ...draft, payload })}
            />
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={messageOpen}
          onClick={() => setMessageOpen((value) => !value)}
        >
          <Icon
            icon={CaretDown}
            size={14}
            className={cn("transition-transform duration-200", messageOpen ? "rotate-0" : "-rotate-90")}
          />
          More detail
        </Button>
        {messageOpen ? (
          <ul className="flex flex-col">
            {PAYLOAD_BLOCKS.filter((block) => block.advanced).map((block) => (
              <PayloadRow
                key={block.id}
                block={block}
                payload={draft.payload}
                onChange={(payload) => onChange({ ...draft, payload })}
              />
            ))}
          </ul>
        ) : null}
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
  const checked = children.length === 0
    ? Boolean(payload[block.id])
    : children.every((item) => payload[item.id])
      ? true
      : children.some((item) => payload[item.id])
        ? "indeterminate"
        : false;

  function toggle(next: boolean) {
    const copy = { ...payload, [block.id]: next };
    for (const child of children) copy[child.id] = next;
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
      </div>
      {open ? (
        <div className="flex flex-col gap-2 py-2 pl-8">
          <p className="text-xs leading-relaxed text-fg-muted">{block.detail}</p>
          {children.map((child) => (
            <label key={child.id} className="flex items-center gap-2 text-sm text-fg-primary">
              <Checkbox
                checked={Boolean(payload[child.id])}
                aria-label={child.label}
                onCheckedChange={(value) =>
                  onChange({ ...payload, [block.id]: true, [child.id]: value === true })
                }
              />
              {child.label}
            </label>
          ))}
        </div>
      ) : null}
    </li>
  );
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
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 flex-1 justify-start"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon
            icon={CaretDown}
            size={14}
            className={cn("text-fg-muted transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">{title}</span>
          <span className="truncate text-xs font-normal text-fg-muted">{hint}</span>
        </Button>
        {extra}
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
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
