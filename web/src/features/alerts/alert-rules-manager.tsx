import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/sonner";
import {
  AlertConditionFields,
  type AlertFirstSeenFilter,
  type AlertLevelFilter,
} from "./alert-condition-fields";
import { AlertNotificationFields } from "./alert-notification-fields";
import { AlertWizardSteps } from "./alert-wizard-steps";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  updateAlertRule,
  type AlertRuleFilters,
  type AlertRuleRow,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format-time";
import { DotsThree } from "@/components/ui/icon";

type RuleKind = "velocity_spike" | "issue_created" | "regression";

interface Template {
  id: string;
  kind: RuleKind;
  title: string;
  summary: string;
  name: string;
  threshold: number | null;
}

const TEMPLATES: Template[] = [
  {
    id: "spike",
    kind: "velocity_spike",
    title: "Error spike",
    summary: "Events increase by more than 300% versus the previous 15 minutes.",
    name: "Error spike",
    threshold: 300,
  },
  {
    id: "regression",
    kind: "regression",
    title: "Came back",
    summary: "A resolved issue returns in a later release.",
    name: "Came back",
    threshold: null,
  },
  {
    id: "new",
    kind: "issue_created",
    title: "New issue",
    summary: "A new error fingerprint appears.",
    name: "New issue",
    threshold: null,
  },
  {
    id: "custom",
    kind: "velocity_spike",
    title: "Custom",
    summary: "Start from an error spike and edit the threshold.",
    name: "Custom alert",
    threshold: 300,
  },
];

const BUILTIN: Template[] = TEMPLATES.filter((template) => template.id !== "custom");

function buildFiltersJson(
  minLevel: AlertLevelFilter,
  firstSeen: AlertFirstSeenFilter,
): AlertRuleFilters {
  const filters: AlertRuleFilters = {};
  if (minLevel !== "any") {
    filters.min_level = minLevel;
  }
  if (firstSeen !== "any") {
    filters.first_seen = firstSeen;
  }
  return filters;
}

function readFilters(rule?: AlertRuleRow | null): {
  minLevel: AlertLevelFilter;
  firstSeen: AlertFirstSeenFilter;
} {
  return {
    minLevel: (rule?.filters_json?.min_level as AlertLevelFilter) ?? "any",
    firstSeen: (rule?.filters_json?.first_seen as AlertFirstSeenFilter) ?? "any",
  };
}

function conditionSummary(kind: string, threshold: number | null, environment: string | null): string {
  const where = environment ? `In ${environment}` : "Every environment";
  if (kind === "velocity_spike") {
    return `${where} · events increase by more than ${threshold ?? 300}% versus the previous 15 minutes`;
  }
  if (kind === "regression") {
    return `${where} · a resolved issue comes back`;
  }
  return `${where} · a new error fingerprint appears`;
}

export interface AlertRulesManagerProps {
  projectId: string;
  canManage?: boolean;
  /** Latest trigger time per rule id or built-in kind, when the caller has alert history. */
  lastTriggered?: Record<string, string>;
}

export function AlertRulesManager({
  projectId,
  canManage = true,
  lastTriggered = {},
}: AlertRulesManagerProps) {
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "monitoring" | "paused">("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templateId, setTemplateId] = useState<string>("spike");
  const [kind, setKind] = useState<RuleKind>("velocity_spike");
  const [threshold, setThreshold] = useState("300");
  const [environment, setEnvironment] = useState("production");
  const [name, setName] = useState("");
  const [minLevel, setMinLevel] = useState<AlertLevelFilter>("any");
  const [firstSeen, setFirstSeen] = useState<AlertFirstSeenFilter>("any");
  const [editing, setEditing] = useState<AlertRuleRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const template = TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0];

  function openCreate() {
    setEditing(null);
    setStep(1);
    setTemplateId("spike");
    setKind("velocity_spike");
    setThreshold("300");
    setEnvironment("production");
    setName("");
    setMinLevel("any");
    setFirstSeen("any");
    setWizardOpen(true);
  }

  function chooseTemplate(next: Template) {
    setTemplateId(next.id);
    setKind(next.kind);
    setThreshold(next.threshold == null ? "" : String(next.threshold));
    if (!name.trim()) {
      setName(next.name);
    }
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
    setStep(2);
    setWizardOpen(true);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the alert a name");
      return;
    }
    const parsedThreshold = kind === "velocity_spike" ? Number(threshold) : null;
    if (kind === "velocity_spike" && (!Number.isFinite(parsedThreshold) || (parsedThreshold ?? 0) < 1)) {
      toast.error("Enter how large the spike should be");
      return;
    }
    const filters_json = buildFiltersJson(minLevel, firstSeen);
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
        toast.success("Alert created");
      }
      setWizardOpen(false);
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

  async function remove(rule: AlertRuleRow) {
    setRules((rows) => rows.filter((row) => row.id !== rule.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(rule.id);
      return next;
    });
    try {
      await deleteAlertRule(rule.id);
      toast.success("Alert deleted");
    } catch {
      setRules((rows) => [...rows, rule]);
      toast.error("Could not delete the alert");
    }
  }

  const visibleCustom = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rules.filter((rule) => {
      if (statusFilter === "monitoring" && !rule.enabled) return false;
      if (statusFilter === "paused" && rule.enabled) return false;
      if (!needle) return true;
      return rule.name.toLowerCase().includes(needle) || rule.kind.toLowerCase().includes(needle);
    });
  }, [query, rules, statusFilter]);

  const customIds = useMemo(() => visibleCustom.map((row) => row.id), [visibleCustom]);

  const allCustomSelected =
    customIds.length > 0 && customIds.every((id) => selectedIds.has(id));
  const someCustomSelected = customIds.some((id) => selectedIds.has(id));

  function toggleSelectAllCustom() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allCustomSelected) {
        for (const id of customIds) next.delete(id);
      } else {
        for (const id of customIds) next.add(id);
      }
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetEnabled(enabled: boolean) {
    const targets = rules.filter((row) => selectedIds.has(row.id));
    if (targets.length === 0) return;
    setBulkBusy(true);
    const previous = rules;
    setRules((rows) => rows.map((row) => (selectedIds.has(row.id) ? { ...row, enabled } : row)));
    try {
      await Promise.all(targets.map((row) => updateAlertRule(row.id, { enabled })));
      toast.success(enabled ? "Alerts turned on" : "Alerts paused");
      setSelectedIds(new Set());
    } catch {
      setRules(previous);
      toast.error("Could not update selected alerts");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDeleteSelected() {
    const targets = rules.filter((row) => selectedIds.has(row.id));
    if (targets.length === 0) return;
    setBulkBusy(true);
    const previous = rules;
    setRules((rows) => rows.filter((row) => !selectedIds.has(row.id)));
    try {
      await Promise.all(targets.map((row) => deleteAlertRule(row.id)));
      toast.success(`Deleted ${targets.length} alert${targets.length === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
    } catch {
      setRules(previous);
      toast.error("Could not delete selected alerts");
    } finally {
      setBulkBusy(false);
    }
  }

  const summary = conditionSummary(kind, kind === "velocity_spike" ? Number(threshold) || null : null, environment.trim() || null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Input
            size="sm"
            placeholder="Search rules…"
            aria-label="Search rules"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ToggleGroup
          type="single"
          value={statusFilter}
          onValueChange={(value) => {
            if (value === "all" || value === "monitoring" || value === "paused") {
              setStatusFilter(value);
            }
          }}
          aria-label="Filter rules by status"
        >
          <ToggleGroupItem value="all" size="sm">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="monitoring" size="sm">
            Active
          </ToggleGroupItem>
          <ToggleGroupItem value="paused" size="sm">
            Paused
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={openCreate} disabled={!canManage}>
            Create alert
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2">
          <span className="text-xs font-medium text-fg-primary">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={bulkBusy || !canManage}
            onClick={() => void bulkSetEnabled(true)}
          >
            Turn on
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={bulkBusy || !canManage}
            onClick={() => void bulkSetEnabled(false)}
          >
            Pause
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={bulkBusy || !canManage}
            className="text-semantic-danger hover:text-semantic-danger"
            onClick={() => void bulkDeleteSelected()}
          >
            Delete
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              {canManage ? (
                <Checkbox
                  checked={allCustomSelected ? true : someCustomSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleSelectAllCustom()}
                  aria-label="Select all custom alerts"
                />
              ) : null}
            </TableHead>
            <TableHead className="w-1/2">Rule</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notify</TableHead>
            <TableHead>Last triggered</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {statusFilter !== "paused"
            ? BUILTIN.map((item) => (
                <TableRow key={item.id}>
                  <TableCell />
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg-primary">{item.name}</span>
                      <Badge variant="neutral" size="sm">Default</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fg-muted">{item.summary}</p>
                    <p className="text-[11px] text-fg-muted">Every environment · Per issue</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-fg-muted">On</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-fg-secondary">Monitoring</span>
                  </TableCell>
                  <TableCell className="text-xs text-fg-secondary">Email + webhooks</TableCell>
                  <TableCell className="text-xs tabular-nums text-fg-muted">
                    {lastTriggered[item.kind] ? formatRelativeTime(lastTriggered[item.kind]) : "—"}
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            : null}
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-xs text-fg-muted">
                Loading custom rules…
              </TableCell>
            </TableRow>
          ) : (
            visibleCustom.map((rule) => (
              <TableRow key={rule.id} className="cursor-pointer" onClick={() => canManage && openEdit(rule)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  {canManage ? (
                    <Checkbox
                      checked={selectedIds.has(rule.id)}
                      onCheckedChange={() => toggleSelected(rule.id)}
                      aria-label={`Select ${rule.name}`}
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg-primary">{rule.name}</span>
                    <Badge variant="info" size="sm">Custom</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    {conditionSummary(rule.kind, rule.threshold, rule.environment)}
                  </p>
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  {canManage ? (
                    <Switch
                      checked={rule.enabled}
                      aria-label={rule.enabled ? `Pause ${rule.name}` : `Enable ${rule.name}`}
                      onCheckedChange={() => void toggle(rule)}
                    />
                  ) : (
                    <span className="text-xs text-fg-muted">{rule.enabled ? "On" : "Off"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={rule.enabled ? "text-xs text-fg-secondary" : "text-xs text-fg-muted"}>
                    {rule.enabled ? "Monitoring" : "Paused"}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-fg-secondary">Email + webhooks</TableCell>
                <TableCell className="text-xs tabular-nums text-fg-muted">
                  {lastTriggered[rule.id] ? formatRelativeTime(lastTriggered[rule.id]) : "—"}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Actions for ${rule.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DotsThree className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEdit(rule)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void toggle(rule)}>
                          {rule.enabled ? "Pause" : "Resume"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => void remove(rule)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit alert" : "Create alert"}</DialogTitle>
            <AlertWizardSteps step={editing ? 2 : step} editing={Boolean(editing)} className="mt-1" />
          </DialogHeader>

          {editing ? (
            <label className="block text-xs text-fg-secondary">
              Alert name
              <Input
                size="sm"
                className="mt-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : null}

          {!editing && step === 1 ? (
            <div className="space-y-4">
              <label className="block text-xs text-fg-secondary">
                Alert name
                <Input
                  size="sm"
                  className="mt-1"
                  value={name}
                  placeholder="e.g. Production spike"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <div>
                <p className="mb-2 text-xs font-medium text-fg-primary">Start from a template</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TEMPLATES.map((item) => (
                    <Button
                      key={item.id}
                      variant={templateId === item.id ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => chooseTemplate(item)}
                    >
                      <span className="flex flex-col items-start gap-0.5 text-left">
                        <span>{item.title}</span>
                        <span className="text-[11px] font-normal text-fg-muted">{item.summary}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {(editing || step === 2) && (
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
              summary={summary}
              showKindPicker={Boolean(editing || template.id === "custom")}
            />
          )}

          {!editing && step === 3 ? (
            <AlertNotificationFields projectId={projectId} alertName={name} summary={summary} />
          ) : null}

          <DialogFooter>
            {!editing && step > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((value) => (value === 3 ? 2 : 1))}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {editing ? (
              <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save alert"}
              </Button>
            ) : step < 3 ? (
              <Button
                variant="primary"
                size="sm"
                disabled={step === 1 && !name.trim()}
                onClick={() => setStep((value) => (value === 1 ? 2 : 3))}
              >
                Continue
              </Button>
            ) : (
              <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
                {busy ? "Creating…" : "Create alert"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
