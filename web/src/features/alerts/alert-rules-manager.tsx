import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "@/components/ui/sonner";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  updateAlertRule,
  type AlertRuleRow,
} from "@/lib/api";
import { projectSettingsPath } from "@/lib/paths";
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

  const template = TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0];

  function openCreate() {
    setEditing(null);
    setStep(1);
    setTemplateId("spike");
    setKind("velocity_spike");
    setThreshold("300");
    setEnvironment("production");
    setName("");
    setWizardOpen(true);
  }

  function chooseTemplate(next: Template) {
    setTemplateId(next.id);
    setKind(next.kind);
    setThreshold(next.threshold == null ? "" : String(next.threshold));
    setName(next.name);
    setStep(2);
  }

  function openEdit(rule: AlertRuleRow) {
    setEditing(rule);
    setKind((rule.kind as RuleKind) || "velocity_spike");
    setThreshold(rule.threshold == null ? "" : String(rule.threshold));
    setEnvironment(rule.environment ?? "");
    setName(rule.name);
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
    setBusy(true);
    try {
      if (editing) {
        const updated = await updateAlertRule(editing.id, {
          name: trimmed,
          environment: environment.trim() || null,
          threshold: parsedThreshold,
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
        <Button
          variant={statusFilter === "all" ? "secondary" : "ghost"}
          size="xs"
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
        <Button
          variant={statusFilter === "monitoring" ? "secondary" : "ghost"}
          size="xs"
          onClick={() => setStatusFilter("monitoring")}
        >
          Monitoring
        </Button>
        <Button
          variant={statusFilter === "paused" ? "secondary" : "ghost"}
          size="xs"
          onClick={() => setStatusFilter("paused")}
        >
          Paused
        </Button>
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={openCreate} disabled={!canManage}>
            Create alert
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/2">Rule</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg-primary">{item.name}</span>
                      <Badge variant="neutral" size="sm">Default</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fg-muted">{item.summary}</p>
                    <p className="text-[11px] text-fg-muted">Every environment · Per issue</p>
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
              <TableCell colSpan={5} className="text-xs text-fg-muted">
                Loading custom rules…
              </TableCell>
            </TableRow>
          ) : (
            visibleCustom.map((rule) => (
              <TableRow key={rule.id} className="cursor-pointer" onClick={() => canManage && openEdit(rule)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg-primary">{rule.name}</span>
                    <Badge variant="info" size="sm">Custom</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    {conditionSummary(rule.kind, rule.threshold, rule.environment)}
                  </p>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit alert" : "Create alert"}</DialogTitle>
            <DialogDescription>
              {editing ? "Conditions and name." : "Template → Conditions → Notifications"}
            </DialogDescription>
          </DialogHeader>

          {!editing && step === 1 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TEMPLATES.map((item) => (
                <Button key={item.id} variant="outline" size="sm" onClick={() => chooseTemplate(item)}>
                  <span className="flex flex-col items-start gap-0.5 text-left">
                    <span>{item.title}</span>
                    <span className="text-[11px] font-normal text-fg-muted">{item.summary}</span>
                  </span>
                </Button>
              ))}
            </div>
          ) : null}

          {(editing || step === 2) && (
            <div className="space-y-3">
              {!editing && template.id === "custom" ? (
                <div className="flex flex-wrap gap-1.5">
                  {BUILTIN.map((item) => (
                    <Button
                      key={item.kind}
                      variant={kind === item.kind ? "secondary" : "outline"}
                      size="xs"
                      onClick={() => {
                        setKind(item.kind);
                        setThreshold(item.threshold == null ? "" : String(item.threshold));
                      }}
                    >
                      {item.title}
                    </Button>
                  ))}
                </div>
              ) : null}
              <label className="block text-xs text-fg-secondary">
                Environment
                <Input
                  size="sm"
                  className="mt-1"
                  value={environment}
                  placeholder="production, or blank for every environment"
                  onChange={(event) => setEnvironment(event.target.value)}
                />
              </label>
              {kind === "velocity_spike" ? (
                <label className="block text-xs text-fg-secondary">
                  Spike is above (%)
                  <Input
                    size="sm"
                    className="mt-1"
                    type="number"
                    min={1}
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                </label>
              ) : null}
              <p className="rounded-md border border-border-subtle bg-surface-2/50 px-3 py-2 text-xs text-fg-secondary">
                {summary}
              </p>
            </div>
          )}

          {!editing && step === 3 ? (
            <div className="space-y-3">
              <p className="text-xs text-fg-secondary">
                Notifications go to this project's email alerts and connected webhooks.
              </p>
              <Button variant="ghost" size="xs" asChild>
                <Link to={projectSettingsPath(projectId, "webhooks")}>Connect a channel</Link>
              </Button>
              <label className="block text-xs text-fg-secondary">
                Alert name
                <Input size="sm" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <p className="rounded-md border border-border-subtle bg-surface-2/50 px-3 py-2 text-xs text-fg-secondary">
                {summary}
              </p>
            </div>
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
              <Button variant="primary" size="sm" disabled={step === 1} onClick={() => setStep(3)}>
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
