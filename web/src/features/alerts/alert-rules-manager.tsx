import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  AlertRuleListRow,
  ALERT_RULE_COL_END,
  ALERT_RULE_ROW_GRID,
  ALERT_RULE_ROW_MIN_WIDTH,
  type AlertRuleChannelProvider,
} from "@/components/kit/alert-rule-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import {
  AlertConditionFields,
  type AlertFirstSeenFilter,
  type AlertLevelFilter,
} from "./alert-condition-fields";
import { AlertNotificationFields } from "./alert-notification-fields";
import {
  AlertTemplatePicker,
  applyAlertTemplate,
  findAlertTemplate,
  DEFAULT_ALERT_TEMPLATE_ID,
  type AlertTemplateOption,
} from "./alert-template-picker";
import type { RuleKind } from "./alert-template-picker.types";
import { AlertWizardRail, WizardStepBadge } from "./alert-wizard-rail";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertChannels,
  fetchAlertRules,
  updateAlertRule,
  type AlertChannelRow,
  type AlertRuleFilters,
  type AlertRuleRow,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format-time";
import {
  ArrowRight,
  Copy,
  DotsThree,
  Icon,
  Pause,
  PencilSimple,
  Play,
  Trash,
} from "@/components/ui/icon";
import { DialogDescription } from "@/components/ui/dialog";
import {
  matchesDestinationFilter,
  ruleDestinationPreview,
  ruleDurationLabel,
  ruleLastTriggeredDemo,
  type RuleDestinationKind,
} from "./alert-rules-display";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";
import { AlertsRulesBulkBar } from "./alerts-rules-bulk-bar";
import type { RulesStatusFilter } from "./alerts-toolbar";

function buildFiltersJson(
  minLevel: AlertLevelFilter,
  firstSeen: AlertFirstSeenFilter,
  customQuery?: string,
  cooldownMinutes?: number | null,
  existingFilters?: AlertRuleFilters | null,
): AlertRuleFilters {
  const filters: AlertRuleFilters = { ...(existingFilters ?? {}) };
  if (minLevel !== "any") {
    filters.min_level = minLevel;
  } else {
    delete filters.min_level;
  }
  if (firstSeen !== "any") {
    filters.first_seen = firstSeen;
  } else {
    delete filters.first_seen;
  }
  if (customQuery && customQuery.trim()) {
    filters.query = customQuery.trim();
  } else {
    delete filters.query;
  }
  if (cooldownMinutes) {
    filters.cooldown_minutes = cooldownMinutes;
  } else {
    delete filters.cooldown_minutes;
  }
  return filters;
}

function readFilters(rule?: AlertRuleRow | null): {
  minLevel: AlertLevelFilter;
  firstSeen: AlertFirstSeenFilter;
  customQuery: string;
  cooldownMinutes: number | null;
} {
  return {
    minLevel: (rule?.filters_json?.min_level as AlertLevelFilter) ?? "any",
    firstSeen: (rule?.filters_json?.first_seen as AlertFirstSeenFilter) ?? "any",
    customQuery: (rule?.filters_json?.query as string) ?? "",
    cooldownMinutes: (rule?.filters_json?.cooldown_minutes as number) ?? null,
  };
}

function conditionSummary(
  kind: string,
  threshold: number | null,
  environment: string | null,
  customQuery?: string,
): string {
  const where = environment ? `In ${environment}` : "Every environment";
  if (kind === "velocity_spike") {
    return `${where} · events increase by more than ${threshold ?? 300}% versus the previous 15 minutes`;
  }
  if (kind === "users_affected") {
    return `${where} · affects more than ${threshold ?? 50} unique users`;
  }
  if (kind === "event_milestone") {
    return `${where} · reaches ${threshold ?? 1000} cumulative events`;
  }
  if (kind === "regression") {
    return `${where} · a resolved issue comes back`;
  }
  if (kind === "custom") {
    return `${where} · matches custom query ${customQuery ? `"${customQuery}"` : "criteria"}`;
  }
  return `${where} · a new error fingerprint appears`;
}

function channelForRule(rule: AlertRuleRow, channels: AlertChannelRow[], index: number) {
  const linked = (rule.channel_ids ?? [])
    .map((id) => channels.find((channel) => channel.id === id))
    .filter((channel): channel is AlertChannelRow => Boolean(channel));
  if (linked.length > 0) {
    const first = linked[0];
    return {
      provider: asChannelProvider(first.provider),
      label: first.label,
      extra: linked.length > 1 ? linked.length - 1 : undefined,
    };
  }
  const preview = ruleDestinationPreview(rule, index);
  const provider = preview.kind === "slack" || preview.kind === "discord" || preview.kind === "email" || preview.kind === "webhook"
    ? preview.kind
    : "webhook";
  const extra = preview.extra ? Number(preview.extra.replace(/[^\d]/g, "")) : undefined;
  return { provider, label: preview.label, extra: extra && extra > 0 ? extra : undefined };
}

function asChannelProvider(provider: string): AlertRuleChannelProvider {
  if (provider === "slack" || provider === "discord" || provider === "telegram" || provider === "email" || provider === "webhook") {
    return provider;
  }
  return "webhook";
}

export interface AlertRulesManagerHandle {
  openCreate: () => void;
  openEdit: (ruleId: string) => void;
  bulkSetEnabled: (ids: string[], enabled: boolean) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
}

export interface AlertRulesManagerProps {
  projectId: string;
  projectSlug?: string;
  canManage?: boolean;
  query?: string;
  statusFilter?: RulesStatusFilter;
  destinationFilter?: RuleDestinationKind;
  activeRuleId?: string | null;
  onActiveRuleIdChange?: (ruleId: string | null) => void;
  onEditRule?: (rule: AlertRuleRow) => void;
  /** Latest trigger time per rule id or built-in kind, when the caller has alert history. */
  lastTriggered?: Record<string, string>;
  /** How many alerts each rule id has fired. */
  firedCounts?: Record<string, number>;
  selectedRuleIds?: Set<string>;
  onRuleSelectChange?: (ruleId: string, selected: boolean) => void;
  selectionActive?: boolean;
  onFilteredRuleIdsChange?: (ids: string[]) => void;
  onRulesCountsChange?: (counts: { total: number; active: number; visible: number }) => void;
  allFilteredSelected?: boolean;
  someFilteredSelected?: boolean;
  onToggleSelectAllFiltered?: () => void;
}

export const AlertRulesManager = forwardRef<AlertRulesManagerHandle, AlertRulesManagerProps>(
  function AlertRulesManager(
    {
      projectId,
      projectSlug: _projectSlug = "checkout-web",
      canManage = true,
      query = "",
      statusFilter = "all",
      destinationFilter = "all",
      activeRuleId = null,
      onActiveRuleIdChange,
      onEditRule,
      lastTriggered = {},
      firedCounts: _firedCounts = {},
      selectedRuleIds,
      onRuleSelectChange,
      selectionActive = false,
      onFilteredRuleIdsChange,
      onRulesCountsChange,
      allFilteredSelected: _allFilteredSelected = false,
      someFilteredSelected: _someFilteredSelected = false,
      onToggleSelectAllFiltered,
    },
    ref,
  ) {
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [channels, setChannels] = useState<AlertChannelRow[]>([]);
  const [ownedSelection, setOwnedSelection] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templateId, setTemplateId] = useState<string>(DEFAULT_ALERT_TEMPLATE_ID);
  const [kind, setKind] = useState<RuleKind>("velocity_spike");
  const [threshold, setThreshold] = useState("300");
  const [environment, setEnvironment] = useState("production");
  const [name, setName] = useState("");
  const [minLevel, setMinLevel] = useState<AlertLevelFilter>("any");
  const [firstSeen, setFirstSeen] = useState<AlertFirstSeenFilter>("any");
  const [customQuery, setCustomQuery] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState<number | null>(null);
  const [editing, setEditing] = useState<AlertRuleRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await fetchAlertRules(projectId));
    } catch {
      setRules([]);
      toast.error("Could not load alert rules");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!projectId) {
      setChannels([]);
      return;
    }
    let cancelled = false;
    void fetchAlertChannels(projectId)
      .then((rows) => {
        if (!cancelled) setChannels(rows);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const template = findAlertTemplate(templateId);

  function openCreate() {
    setEditing(null);
    setStep(1);
    const defaults = applyAlertTemplate(findAlertTemplate(DEFAULT_ALERT_TEMPLATE_ID));
    setTemplateId(defaults.templateId);
    setKind(defaults.kind);
    setThreshold(defaults.threshold);
    setEnvironment(defaults.environment);
    setName("");
    setMinLevel(defaults.minLevel);
    setFirstSeen(defaults.firstSeen);
    setCustomQuery("");
    setCooldownMinutes(null);
    setWizardOpen(true);
  }

  function chooseTemplate(next: AlertTemplateOption) {
    const defaults = applyAlertTemplate(next);
    setTemplateId(defaults.templateId);
    setKind(defaults.kind);
    setThreshold(defaults.threshold);
    setEnvironment(defaults.environment);
    setMinLevel(defaults.minLevel);
    setFirstSeen(defaults.firstSeen);
    setCustomQuery("");
    setCooldownMinutes(null);
    if (!name.trim() || name.trim() === template.defaultName) {
      setName(defaults.name);
    }
  }

  function advanceFromTemplateStep() {
    if (!name.trim() && template) {
      setName(template.defaultName);
    }
    setStep(2);
  }

  function openEdit(rule: AlertRuleRow) {
    setEditing(rule);
    setKind((rule.kind as RuleKind) || "velocity_spike");
    setThreshold(rule.threshold == null ? "" : String(rule.threshold));
    setEnvironment(rule.environment ?? "");
    setName(rule.name);
    const filters = readFilters(rule);
    setMinLevel(filters.minLevel);
    setFirstSeen(filters.firstSeen);
    setCustomQuery(filters.customQuery);
    setCooldownMinutes(filters.cooldownMinutes);
    setStep(2);
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setEditing(null);
    setStep(1);
    setCustomQuery("");
    setCooldownMinutes(null);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the alert a name");
      return;
    }
    const parsedThreshold =
      kind === "velocity_spike"
        ? Number(threshold)
        : null;
    if (
      kind === "velocity_spike" &&
      (!Number.isFinite(parsedThreshold) || (parsedThreshold ?? 0) < 1)
    ) {
      toast.error("Enter a valid threshold");
      return;
    }
    const filters_json = buildFiltersJson(
      minLevel,
      firstSeen,
      customQuery,
      cooldownMinutes,
      editing?.filters_json,
    );
    setBusy(true);
    try {
      if (editing) {
        const updated = await updateAlertRule(editing.id, {
          name: trimmed,
          environment: environment.trim() || null,
          threshold: parsedThreshold,
          filters_json,
        });
        setRules((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
        toast.success("Alert updated");
      } else {
        const created = await createAlertRule({
          project_id: projectId,
          name: trimmed,
          kind,
          environment: environment.trim() || null,
          threshold: parsedThreshold,
          filters_json,
          enabled: true,
        });
        setRules((rows) => [...rows, created]);
        toast.success("Rule saved. Notifications use subscribed project webhooks.");
      }
      closeWizard();
    } catch {
      toast.error(editing ? "Could not update the alert" : "Could not create the alert");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(rule: AlertRuleRow) {
    const next = !rule.enabled;
    setRules((rows) => rows.map((row) => (row.id === rule.id ? { ...row, enabled: next } : row)));
    try {
      await updateAlertRule(rule.id, { enabled: next });
    } catch {
      setRules((rows) => rows.map((row) => (row.id === rule.id ? rule : row)));
      toast.error("Could not update the alert");
    }
  }

  async function duplicate(rule: AlertRuleRow) {
    setBusy(true);
    try {
      const created = await createAlertRule({
        project_id: projectId,
        name: `${rule.name} (copy)`,
        kind: rule.kind,
        environment: rule.environment,
        threshold: rule.threshold,
        filters_json: rule.filters_json ?? {},
        enabled: rule.enabled,
      });
      setRules((rows) => [...rows, created]);
      toast.success("Rule duplicated");
    } catch {
      toast.error("Could not duplicate the rule");
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: AlertRuleRow) {
    setRules((rows) => rows.filter((row) => row.id !== rule.id));
    try {
      await deleteAlertRule(rule.id);
      toast.success("Rule deleted");
    } catch {
      setRules((rows) => [...rows, rule]);
      toast.error("Could not delete the rule");
    }
  }

  const bulkSetEnabled = useCallback(
    async (ids: string[], enabled: boolean) => {
      if (ids.length === 0) {
        return;
      }
      setBusy(true);
      const previous = rules;
      setRules((rows) => rows.map((row) => (ids.includes(row.id) ? { ...row, enabled } : row)));
      try {
        await Promise.all(ids.map((id) => updateAlertRule(id, { enabled })));
        toast.success(enabled ? "Rules enabled" : "Rules paused");
      } catch {
        setRules(previous);
        toast.error("Could not update rules");
      } finally {
        setBusy(false);
      }
    },
    [rules],
  );

  const bulkDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      setBusy(true);
      const removed = rules.filter((row) => ids.includes(row.id));
      setRules((rows) => rows.filter((row) => !ids.includes(row.id)));
      try {
        await Promise.all(ids.map((id) => deleteAlertRule(id)));
        toast.success(`Deleted ${ids.length} rule${ids.length === 1 ? "" : "s"}`);
      } catch {
        setRules((rows) => [...rows, ...removed]);
        toast.error("Could not delete rules");
      } finally {
        setBusy(false);
      }
    },
    [rules],
  );

  const visibleCustom = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rules.filter((rule, index) => {
      if (statusFilter === "monitoring" && !rule.enabled) return false;
      if (statusFilter === "paused" && rule.enabled) return false;
      if (
        !matchesDestinationFilter(ruleDestinationPreview(rule, index), destinationFilter)
      ) {
        return false;
      }
      if (!needle) return true;
      return rule.name.toLowerCase().includes(needle) || rule.kind.toLowerCase().includes(needle);
    });
  }, [query, rules, statusFilter, destinationFilter]);

  useEffect(() => {
    onFilteredRuleIdsChange?.(visibleCustom.map((row) => row.id));
  }, [onFilteredRuleIdsChange, visibleCustom]);

  useEffect(() => {
    onRulesCountsChange?.({
      total: rules.length,
      active: rules.filter((row) => row.enabled).length,
      visible: visibleCustom.length,
    });
  }, [onRulesCountsChange, rules, visibleCustom.length]);

  useImperativeHandle(
    ref,
    () => ({
      openCreate,
      openEdit: (ruleId: string) => {
        const rule = rules.find((row) => row.id === ruleId);
        if (rule) {
          openEdit(rule);
        }
      },
      bulkSetEnabled,
      bulkDelete,
    }),
    [bulkDelete, bulkSetEnabled, rules],
  );

  const summary = conditionSummary(
    kind,
    kind === "velocity_spike"
      ? Number(threshold) || null
      : null,
    environment.trim() || null,
    customQuery,
  );

  const selection = selectedRuleIds ?? ownedSelection;
  const bulkActive = selectionActive || selection.size > 0;
  const selectedIds = [...selection];
  const visibleIds = visibleCustom.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.has(id));
  const someVisibleSelected = visibleIds.some((id) => selection.has(id)) && !allVisibleSelected;
  function toggleVisibleSelection() {
    if (onToggleSelectAllFiltered && selectedRuleIds) {
      onToggleSelectAllFiltered();
      return;
    }
    setOwnedSelection((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    if (selectedRuleIds && onRuleSelectChange) {
      for (const id of selectedIds) onRuleSelectChange(id, false);
      return;
    }
    setOwnedSelection(new Set());
  }

  return (
    <div className="space-y-3">
      <AlertsRulesBulkBar
        selectedCount={selection.size}
        totalCount={visibleCustom.length}
        allSelected={allVisibleSelected}
        someSelected={someVisibleSelected || allVisibleSelected}
        busy={busy}
        canManage={canManage}
        onToggleSelectAll={toggleVisibleSelection}
        onClear={clearSelection}
        onEnable={() => void bulkSetEnabled(selectedIds, true)}
        onPause={() => void bulkSetEnabled(selectedIds, false)}
        onDelete={() =>
          void bulkDelete(selectedIds).then(() => {
            clearSelection();
          })
        }
      />
      <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
        <div className={ALERT_RULE_ROW_MIN_WIDTH}>
        <div
          className={cn(
            "group/header grid items-center border-b border-border-subtle bg-surface-2/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-fg-muted",
            ALERT_RULE_ROW_GRID,
          )}
        >
          <div className="flex size-4 items-center justify-center">
            {canManage ? (
              <Checkbox
                checked={someVisibleSelected ? "indeterminate" : allVisibleSelected}
                aria-label="Select all rules in view"
                className={cn(
                  "transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                  bulkActive
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0 group-hover/header:pointer-events-auto group-hover/header:opacity-100",
                )}
                onCheckedChange={toggleVisibleSelection}
              />
            ) : null}
          </div>
          <span className="sr-only">Enabled</span>
          <span>Rule</span>
          <span className={ALERT_RULE_COL_END}>Duration</span>
          <span className={ALERT_RULE_COL_END}>Last fired</span>
          <span className={ALERT_RULE_COL_END}>Channel</span>
          <span className="sr-only">Actions</span>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-xs text-fg-muted">Loading rules…</p>
        ) : visibleCustom.length === 0 ? (
          <p className="px-4 py-6 text-xs text-fg-muted">No rules match these filters.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {visibleCustom.map((rule) => {
              const ruleIndex = Math.max(0, rules.findIndex((row) => row.id === rule.id));
              const selected = activeRuleId === rule.id;
              const selection = selectedRuleIds ?? ownedSelection;
              const bulkSelected = selection.has(rule.id);
              const setSelected = onRuleSelectChange ?? ((id: string, next: boolean) => {
                setOwnedSelection((current) => {
                  const copy = new Set(current);
                  if (next) copy.add(id);
                  else copy.delete(id);
                  return copy;
                });
              });
              const lastIso =
                lastTriggered[rule.id] ?? lastTriggered[rule.kind] ?? ruleLastTriggeredDemo(rule.id);
              const lastLabel = lastIso ? formatRelativeTime(lastIso) : "—";
              return (
                <li key={rule.id}>
                  <AlertRuleListRow
                    name={rule.name}
                    description={
                      typeof rule.filters_json?.description === "string"
                        ? rule.filters_json.description
                        : undefined
                    }
                    duration={ruleDurationLabel(rule)}
                    lastFired={lastLabel}
                    channel={channelForRule(rule, channels, ruleIndex)}
                    selected={selected}
                    bulkSelected={bulkSelected}
                    selectionActive={bulkActive}
                    paused={!rule.enabled}
                    onSelectChange={canManage ? (next) => setSelected(rule.id, next) : undefined}
                    onEnabledChange={
                      canManage
                        ? (enabled) => {
                            if (enabled === rule.enabled) return;
                            void toggle(rule);
                          }
                        : undefined
                    }
                    onOpen={() => onActiveRuleIdChange?.(rule.id)}
                    actions={
                      canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${rule.name}`}>
                              <Icon icon={DotsThree} size={16} aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[11rem]">
                            <DropdownMenuItem onSelect={() => (onEditRule ? onEditRule(rule) : openEdit(rule))}>
                              <Icon icon={PencilSimple} size={14} className="mr-2" />
                              Edit rule
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void duplicate(rule)}>
                              <Icon icon={Copy} size={14} className="mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void toggle(rule)}>
                              <Icon icon={rule.enabled ? Pause : Play} size={14} className="mr-2" />
                              {rule.enabled ? "Pause rule" : "Resume rule"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-semantic-danger focus:text-semantic-danger"
                              onSelect={() => void remove(rule)}
                            >
                              <Icon icon={Trash} size={14} className="mr-2" />
                              Delete rule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-healthy" aria-hidden />
          Alert engine status: nominal · Evaluation cycle: 30s
        </p>
        <p className="font-mono tabular-nums">
          Showing {visibleCustom.length} of {rules.length} rules
        </p>
      </div>

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) closeWizard();
          else setWizardOpen(true);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,740px)] w-full max-w-[560px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="mb-0 shrink-0 space-y-2 border-b border-border-subtle px-5 pb-3 pt-4">
            {editing ? (
              <nav className="flex items-center gap-1.5 text-xs" aria-label="Edit rule steps">
                <Button
                  type="button"
                  variant={step === 2 ? "secondary" : "ghost"}
                  size="xs"
                  className="h-7 font-mono uppercase tracking-wide"
                  onClick={() => setStep(2)}
                >
                  Scope
                </Button>
                <span className="text-fg-muted/40">/</span>
                <Button
                  type="button"
                  variant={step === 3 ? "secondary" : "ghost"}
                  size="xs"
                  className="h-7 font-mono uppercase tracking-wide"
                  onClick={() => setStep(3)}
                >
                  Dispatch
                </Button>
              </nav>
            ) : (
              <AlertWizardRail step={step} />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="mb-0">
                {editing
                  ? step === 3
                    ? "Routing & review"
                    : "Edit rule"
                  : step === 1
                    ? "Select trigger template"
                    : step === 2
                      ? "Scope & conditions"
                      : "Dispatch & validate"}
              </DialogTitle>
              {!editing ? <WizardStepBadge step={step} /> : null}
            </div>
            {!editing ? (
              <DialogDescription className="leading-snug">
                {step === 1
                  ? "Pick a starter pattern—thresholds and scope are prefilled; you can edit everything on the next step."
                  : step === 2
                    ? "Define evaluation criteria, scope filters, and frequency."
                    : "Select notification destinations and review before arming."}
              </DialogDescription>
            ) : (
              <DialogDescription className="leading-snug">
                {step === 3
                  ? "Review where this rule notifies. Delivery uses subscribed project webhooks."
                  : "Update name, scope, filters, and threshold."}
              </DialogDescription>
            )}
          </DialogHeader>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-5 py-2.5",
              !editing && step === 1 && "bg-bg-subtle/30",
            )}
          >
            {!editing && step === 1 ? (
              <AlertTemplatePicker
                value={templateId}
                onChange={chooseTemplate}
                onPickAndContinue={(tpl) => {
                  chooseTemplate(tpl);
                  advanceFromTemplateStep();
                }}
              />
            ) : null}

            {step === 2 ? (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                    Rule name
                  </p>
                  <Input
                    id={editing ? "alert-rule-name-edit" : "alert-rule-name-create"}
                    size="sm"
                    className="h-8"
                    value={name}
                    placeholder={template?.defaultName ?? "Production error spike"}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <AlertConditionFields
                  kind={kind}
                  onKindChange={(next) => setKind(next)}
                  environment={environment}
                  onEnvironmentChange={setEnvironment}
                  threshold={threshold}
                  onThresholdChange={setThreshold}
                  minLevel={minLevel}
                  onMinLevelChange={setMinLevel}
                  firstSeen={firstSeen}
                  onFirstSeenChange={setFirstSeen}
                  customQuery={customQuery}
                  onCustomQueryChange={setCustomQuery}
                  cooldownMinutes={cooldownMinutes}
                  onCooldownMinutesChange={setCooldownMinutes}
                  summary={summary}
                  showKindPicker={Boolean(editing)}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <AlertNotificationFields projectId={projectId} alertName={name} summary={summary} />
            ) : null}
          </div>

          <DialogFooter className="mb-0 shrink-0 flex-row items-center justify-between gap-3 border-t border-border-subtle/80 bg-surface-1 px-6 py-3.5 pt-3.5 sm:justify-between">
            {(editing && step === 3) || (!editing && step > 1) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((value) => (value === 3 ? 2 : 1))}
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            {editing ? (
              step < 3 ? (
                <Button variant="primary" size="sm" onClick={() => setStep(3)}>
                  Next
                  <Icon icon={ArrowRight} size={14} aria-hidden />
                </Button>
              ) : (
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save"}
                </Button>
              )
            ) : step < 3 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => (step === 1 ? advanceFromTemplateStep() : setStep(3))}
              >
                Next
                <Icon icon={ArrowRight} size={14} aria-hidden />
              </Button>
            ) : (
              <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
},
);
