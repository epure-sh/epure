import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail, Send } from "lucide-react";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  fetchProjectEmailAlertSettings,
  sendTestEmailAlert,
  updateAlertRule,
  updateProjectEmailAlertSettings,
  type AlertRuleRow,
} from "../../lib/api";
import { cn } from "../../lib/cn";
import { projectPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
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
  const { user, projects, projectId: contextProjectId, projectsLoading } = useAppContext();
  const { toast } = useToast();
  const [rules, setRules] = useState<AlertRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RuleKind>("velocity_spike");
  const [environment, setEnvironment] = useState("production");
  const [threshold, setThreshold] = useState("300");

  const [emailAlertsLoading, setEmailAlertsLoading] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [emailOnRegression, setEmailOnRegression] = useState(true);
  const [emailOnSpike, setEmailOnSpike] = useState(true);
  const [customRecipientsMode, setCustomRecipientsMode] = useState(false);
  const [customRecipientsInput, setCustomRecipientsInput] = useState("");
  const [savingEmailAlerts, setSavingEmailAlerts] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [testAlertOpen, setTestAlertOpen] = useState(false);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = useMemo(() => {
    const candidate = paramId ?? contextProjectId;
    if (candidate) {
      const match = safeProjects.find((row) => row && (row.id === candidate || row.slug === candidate));
      if (match) return match;
    }
    return safeProjects[0] ?? null;
  }, [paramId, contextProjectId, safeProjects]);

  const activeProjectId = activeProject?.id ?? null;
  const canManage = user?.role === "owner" || user?.role === "admin";
  const selectedKind = RULE_KINDS.find((item) => item.id === kind) ?? RULE_KINDS[0];

  const loadEmailAlertSettings = useCallback(async () => {
    if (projectsLoading || !activeProjectId) return;
    try {
      const settings = await fetchProjectEmailAlertSettings(activeProjectId);
      setEmailAlertsEnabled(settings?.email_alerts_enabled ?? true);
      setEmailOnRegression(settings?.email_alert_on_regression ?? true);
      setEmailOnSpike(settings?.email_alert_on_spike ?? true);
      if (Array.isArray(settings?.email_alert_recipients) && settings.email_alert_recipients.length > 0) {
        setCustomRecipientsMode(true);
        setCustomRecipientsInput(settings.email_alert_recipients.join(", "));
      } else {
        setCustomRecipientsMode(false);
        setCustomRecipientsInput("");
      }
    } catch {
      // Defaults to true
    } finally {
      setEmailAlertsLoading(false);
    }
  }, [projectsLoading, activeProjectId]);

  const loadRules = useCallback(async () => {
    if (projectsLoading) return;
    if (!activeProjectId || !canManage) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fetched = await fetchAlertRules(activeProjectId);
      setRules(Array.isArray(fetched) ? fetched : []);
    } catch {
      toast("Failed to load alert rules");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [projectsLoading, activeProjectId, canManage, toast]);

  useEffect(() => {
    void loadRules();
    void loadEmailAlertSettings();
  }, [loadRules, loadEmailAlertSettings]);

  const handleSaveEmailAlerts = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return;
    setSavingEmailAlerts(true);
    try {
      const recipients = customRecipientsMode
        ? customRecipientsInput
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.includes("@"))
        : [];
      await updateProjectEmailAlertSettings(activeProjectId, {
        email_alerts_enabled: emailAlertsEnabled,
        email_alert_on_regression: emailOnRegression,
        email_alert_on_spike: emailOnSpike,
        email_alert_recipients: recipients,
      });
      toast("Email alert settings saved successfully");
    } catch {
      toast("Failed to save email alert settings");
    } finally {
      setSavingEmailAlerts(false);
    }
  };

  const handleSendTestEmail = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!activeProjectId) return;
    setTestingEmail(true);
    try {
      const target = testEmailRecipient.trim() || undefined;
      const res = await sendTestEmailAlert(activeProjectId, target);
      if (res.sent) {
        toast(`Test email sent via Resend to ${res.recipient}! Check inbox.`);
        setTestAlertOpen(false);
      } else {
        toast(res.error ? `Failed to send test email: ${res.error}` : "Failed to send test email");
      }
    } catch {
      toast("Error sending test email");
    } finally {
      setTestingEmail(false);
    }
  };

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
      setRules((rows) => (Array.isArray(rows) ? rows : []).map((row) => (row.id === rule.id ? updated : row)));
    } catch {
      toast("Failed to update rule");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, ruleName?: string) {
    if (ruleName && !window.confirm(`Remove alert rule "${ruleName}"?`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteAlertRule(id);
      setRules((rows) => (Array.isArray(rows) ? rows : []).filter((row) => row.id !== id));
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

      {/* Email Alerting Settings (Resend) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <CardTitle>Email Alert Notifications</CardTitle>
            </div>
            <Badge variant="env">Resend · alert.epure.sh</Badge>
          </div>
          <CardDescription>
            Configure automated email notifications dispatched when critical production issues or velocity spikes occur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailAlertsLoading ? (
            <p className="text-xs text-fg-muted">Loading email settings…</p>
          ) : (
            <form onSubmit={(e) => void handleSaveEmailAlerts(e)} className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-1 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-fg-primary">Enable Email Alerts</span>
                  <p className="text-2xs text-fg-muted">
                    Send real-time alert emails from alerts@alert.epure.sh
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-fg-primary cursor-pointer select-none">
                  <Checkbox
                    checked={emailAlertsEnabled}
                    onCheckedChange={(checked) => setEmailAlertsEnabled(checked === true)}
                  />
                  <span>Active</span>
                </label>
              </div>

              {emailAlertsEnabled && (
                <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-2/40 p-3.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                    Trigger Conditions
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-xs text-fg-primary cursor-pointer select-none">
                      <Checkbox
                        checked={emailOnRegression}
                        onCheckedChange={(checked) => setEmailOnRegression(checked === true)}
                      />
                      <span>Issue Regressions (reopened)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-fg-primary cursor-pointer select-none">
                      <Checkbox
                        checked={emailOnSpike}
                        onCheckedChange={(checked) => setEmailOnSpike(checked === true)}
                      />
                      <span>Velocity Spikes (&gt;300%)</span>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-border-subtle space-y-2">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                      Recipients
                    </span>
                    <RadioGroup
                      value={customRecipientsMode ? "custom" : "all"}
                      onValueChange={(val) => setCustomRecipientsMode(val === "custom")}
                      className="space-y-2"
                    >
                      <label className="flex items-center gap-2 text-xs text-fg-primary cursor-pointer select-none">
                        <RadioGroupItem value="all" id="mode-all" />
                        <span>All workspace team members</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-fg-primary cursor-pointer select-none">
                        <RadioGroupItem value="custom" id="mode-custom" />
                        <span>Custom email list</span>
                      </label>
                    </RadioGroup>

                    {customRecipientsMode && (
                      <Field
                        label="Recipient Emails"
                        hint="Comma-separated list of email addresses."
                        className="mt-2"
                      >
                        <Input
                          value={customRecipientsInput}
                          onChange={(e) => setCustomRecipientsInput(e.target.value)}
                          placeholder="eng-alerts@company.com, oncall@company.com"
                        />
                      </Field>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button type="submit" variant="primary" size="sm" disabled={savingEmailAlerts}>
                  {savingEmailAlerts ? "Saving…" : "Save Email Settings"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTestEmailRecipient(user?.email ?? "");
                    setTestAlertOpen(true);
                  }}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send Test Alert…
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Test Alert Dialog */}
      <Dialog open={testAlertOpen} onOpenChange={setTestAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Alert Email</DialogTitle>
            <DialogDescription>
              Dispatch a sample alert email via Resend to verify your mailbox delivery and alert layout.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSendTestEmail(e)} className="space-y-4">
            <Field
              label="Recipient Email"
              hint="Leave blank to send to your logged-in email."
            >
              <Input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder={user?.email ?? "recipient@example.com"}
                autoFocus
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTestAlertOpen(false)}
                disabled={testingEmail}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={testingEmail}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {testingEmail ? "Sending…" : "Send Test Alert"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                variant="outline"
                size="xs"
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
                <SelectTrigger aria-label="Alert type" className="w-full">
                  <SelectValue placeholder="Alert type">{selectedKind.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RULE_KINDS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-fg-muted">{selectedKind.description}</p>
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

      {(() => {
        const safeRules = Array.isArray(rules) ? rules : [];
        return (
          <Card>
            <CardHeader>
              <CardTitle>Project rules</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading…"
                  : safeRules.length === 0
                    ? "No custom rules yet — built-in engines still run."
                    : `${safeRules.length} custom rule${safeRules.length === 1 ? "" : "s"}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-0">
              {loading ? (
                <p className="p-5 text-xs text-fg-muted">Loading rules…</p>
              ) : safeRules.length === 0 ? (
                <p className="p-5 text-xs text-fg-muted">
                  Use a template above if you only want extra notifications for production.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {safeRules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className={cn("text-sm font-medium text-fg-primary", !rule.enabled && "opacity-60")}>
                      {rule.name}
                    </p>
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
                    <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer select-none">
                      <Checkbox
                        checked={rule.enabled}
                        disabled={busy}
                        onCheckedChange={(checked) => void handleToggle(rule, checked === true)}
                        aria-label={`Enable ${rule.name}`}
                      />
                      <span>On</span>
                    </label>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleDelete(rule.id, rule.name)}
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
        );
      })()}
    </div>
  );
}
