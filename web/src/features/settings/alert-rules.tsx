import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  updateAlertRule,
  type AlertRuleRow,
} from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
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
import { InfoCallout, MemberAccessNotice, SettingsTabHeader } from "./shared";

const RULE_KINDS = [
  {
    id: "velocity_spike",
    label: "Velocity spike",
    description: "Event rate jumps vs the previous 15-minute window.",
    usesThreshold: true,
  },
  {
    id: "issue_created",
    label: "New issue",
    description: "First time a fingerprint appears.",
    usesThreshold: false,
  },
  {
    id: "regression",
    label: "Came back",
    description: "A resolved exception returns in a later release.",
    usesThreshold: false,
  },
] as const;

type RuleKind = (typeof RULE_KINDS)[number]["id"];

interface RuleTemplate {
  name: string;
  kind: RuleKind;
  environment: string;
  threshold: number | null;
}

const TEMPLATES: RuleTemplate[] = [
  {
    name: "Production velocity > 300%",
    kind: "velocity_spike",
    environment: "production",
    threshold: 300,
  },
  {
    name: "New issue in production",
    kind: "issue_created",
    environment: "production",
    threshold: null,
  },
  {
    name: "Came back in production",
    kind: "regression",
    environment: "production",
    threshold: null,
  },
];

function kindLabel(kind: string): string {
  return RULE_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function AlertRulesSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { user } = useAppContext();
  const { toast } = useToast();
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RuleKind>("velocity_spike");
  const [environment, setEnvironment] = useState("production");
  const [threshold, setThreshold] = useState("300");

  const activeProjectId = paramId ?? null;
  const canManage = user?.role === "owner" || user?.role === "admin";
  const selectedKind = RULE_KINDS.find((item) => item.id === kind) ?? RULE_KINDS[0];

  const loadRules = useCallback(async () => {
    if (!activeProjectId || !canManage) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRules(await fetchAlertRules(activeProjectId));
    } catch {
      toast("Failed to load alert rules");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, canManage, toast]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  function applyTemplate(template: RuleTemplate) {
    setName(template.name);
    setKind(template.kind);
    setEnvironment(template.environment);
    setThreshold(template.threshold != null ? String(template.threshold) : "300");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProjectId) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const parsedThreshold = selectedKind.usesThreshold ? Number(threshold) : null;
    if (selectedKind.usesThreshold && (!Number.isFinite(parsedThreshold) || (parsedThreshold ?? 0) <= 0)) {
      toast("Enter a velocity percent greater than 0");
      return;
    }

    setBusy(true);
    try {
      await createAlertRule({
        project_id: activeProjectId,
        name: trimmed,
        kind,
        environment: environment.trim() || null,
        threshold: selectedKind.usesThreshold ? parsedThreshold : null,
      });
      setName("");
      await loadRules();
      toast("Alert rule added");
    } catch {
      toast("Failed to add alert rule");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(rule: AlertRuleRow, enabled: boolean) {
    setBusy(true);
    try {
      const updated = await updateAlertRule(rule.id, { enabled });
      setRules((rows) => rows.map((row) => (row.id === rule.id ? updated : row)));
    } catch {
      toast("Failed to update rule");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteAlertRule(id);
      setRules((rows) => rows.filter((row) => row.id !== id));
      toast("Alert rule removed");
    } catch {
      toast("Failed to remove rule");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return <MemberAccessNotice resource="alert rules" />;
  }

  if (!activeProjectId) {
    return (
      <div className="space-y-4">
        <SettingsTabHeader title="Alert rules" description="Custom notify rules for this project." />
        <InfoCallout variant="warning">Select a project to manage alert rules.</InfoCallout>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        title="Alert rules"
        description="Built-in engines stay on. Add a filter if you only want extra alerts for one environment or a different velocity bar."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={projectPath(activeProjectId, "alerts")}>View alerts</Link>
          </Button>
        }
      />

      <InfoCallout>
        Built-in rules already fire for velocity spikes, new issues, and regressions. A custom rule
        is extra: same type, optional environment, optional velocity percent.
      </InfoCallout>

      <Card>
        <CardHeader>
          <CardTitle>Add rule</CardTitle>
          <CardDescription>Start from a template or pick a type, environment, and threshold.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <Button
                key={template.name}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyTemplate(template)}
              >
                {template.name}
              </Button>
            ))}
          </div>
          <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
            <Field label="Name" htmlFor="alert-rule-name">
              <Input
                id="alert-rule-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Production velocity spike"
              />
            </Field>
            <Field label="Type">
              <Select value={kind} onValueChange={(value) => setKind(value as RuleKind)}>
                <SelectTrigger aria-label="Alert type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_KINDS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-ink-muted">{selectedKind.description}</p>
            </Field>
            <Field
              label="Environment"
              htmlFor="alert-rule-env"
              hint="Leave blank to match every environment."
            >
              <Input
                id="alert-rule-env"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
                placeholder="production"
              />
            </Field>
            {selectedKind.usesThreshold ? (
              <Field
                label="Velocity percent"
                htmlFor="alert-rule-threshold"
                hint="Fires when the current 15-minute window exceeds this percent increase vs the prior window. 300 means 4×."
              >
                <Input
                  id="alert-rule-threshold"
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </Field>
            ) : null}
            <Button type="submit" variant="secondary" disabled={busy || !name.trim()}>
              Add rule
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project rules</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : rules.length === 0
                ? "No custom rules yet — built-in engines still run."
                : `${rules.length} custom rule${rules.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-0">
          {loading ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">Loading rules…</p>
          ) : rules.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-ink-muted">
              Use a template above if you only want extra notifications for production.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-ink">{rule.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{kindLabel(rule.kind)}</Badge>
                      {rule.environment ? <Badge variant="env">{rule.environment}</Badge> : null}
                      {rule.threshold != null ? (
                        <Badge variant="secondary">{rule.threshold}% velocity</Badge>
                      ) : null}
                      {!rule.enabled ? <Badge variant="warning">Paused</Badge> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      <Checkbox
                        checked={rule.enabled}
                        disabled={busy}
                        onCheckedChange={(checked) => void handleToggle(rule, checked === true)}
                        aria-label={`Enable ${rule.name}`}
                      />
                      On
                    </label>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleDelete(rule.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
