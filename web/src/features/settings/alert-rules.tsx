import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail } from "lucide-react";
import {
  fetchProjectEmailAlertSettings,
  updateProjectEmailAlertSettings,
} from "../../lib/api";
import { projectPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { useToast } from "../../ui/toast-provider";
import { AlertRulesManager } from "../alerts/alert-rules-manager";
import { InfoCallout, MemberAccessNotice, SettingsTabHeader } from "./shared";

export function AlertRulesSettings() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const { user, userLoading, projects, projectId: contextProjectId, projectsLoading } = useAppContext();
  const { toast } = useToast();
  const [emailAlertsLoading, setEmailAlertsLoading] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [emailOnRegression, setEmailOnRegression] = useState(true);
  const [emailOnSpike, setEmailOnSpike] = useState(true);
  const [customRecipientsMode, setCustomRecipientsMode] = useState(false);
  const [customRecipientsInput, setCustomRecipientsInput] = useState("");
  const [savingEmailAlerts, setSavingEmailAlerts] = useState(false);

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

  const loadEmailAlertSettings = useCallback(async () => {
    if (projectsLoading || userLoading || !activeProjectId) return;
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
  }, [projectsLoading, userLoading, activeProjectId]);

  useEffect(() => {
    void loadEmailAlertSettings();
  }, [loadEmailAlertSettings]);

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

  if (projectsLoading || userLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg border border-border-subtle bg-surface-1 animate-pulse" />
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="space-y-4">
        <InfoCallout variant="warning">Select a project to manage alert rules.</InfoCallout>
      </div>
    );
  }

  if (!canManage) {
    return <MemberAccessNotice resource="alert rules" />;
  }

  return (
    <div className="space-y-4">
      <SettingsTabHeader
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to={projectPath(activeProjectId, "alerts")}>View history</Link>
          </Button>
        }
      />

      <AlertRulesManager projectId={activeProjectId} canManage={canManage} />

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
              </div>
            </form>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
