import { useEffect, useState } from "react";
import {
  createAlertChannel,
  createAlertRule,
  fetchAlertChannels,
  fetchAlertRules,
  updateAlertRule,
  type AlertChannelRow,
} from "@/lib/api";
import { CreateAlertRulePanel } from "@/components/kit/create-alert-rule";
import {
  draftFromRule,
  templateDraft,
  ruleToApiBody,
  type AlertChannelChoice,
  type AlertRuleDraft,
  type ChannelProvider,
} from "@/components/kit/create-alert-rule-model";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export function CreateAlertRuleDialog({
  open,
  projectId,
  ruleId = null,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  projectId: string | null;
  ruleId?: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<AlertRuleDraft>(() => templateDraft("production-crash"));
  const [channels, setChannels] = useState<AlertChannelChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    if (!ruleId) setDraft(templateDraft("production-crash"));
    if (!projectId) {
      setChannels([]);
      return;
    }
    let cancelled = false;
    void fetchAlertChannels(projectId)
      .then((rows) => {
        if (!cancelled) setChannels(rows.map(toChoice));
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      });
    if (ruleId) {
      void fetchAlertRules(projectId)
        .then((rows) => {
          const rule = rows.find((item) => item.id === ruleId);
          if (!cancelled && rule) setDraft(draftFromRule(rule));
        })
        .catch(() => {
          if (!cancelled) setError("Could not load this rule.");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, projectId, ruleId]);

  async function createChannel(input: { provider: ChannelProvider; label: string }) {
    if (!projectId) return null;
    const row = await createAlertChannel({
      project_id: projectId,
      provider: input.provider,
      label: input.label,
    });
    const choice = toChoice(row);
    setChannels((current) => [...current, choice]);
    return choice;
  }

  async function submit() {
    if (!projectId) {
      setError("Choose a project before creating an alert.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = ruleToApiBody(draft, projectId);
      if (ruleId) {
        await updateAlertRule(ruleId, body);
      } else {
        await createAlertRule(body);
      }
      onCreated?.();
      onOpenChange(false);
    } catch {
      setError(ruleId ? "Could not save this alert." : "Could not save this alert. Check the name and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogTitle className="sr-only">New alert</DialogTitle>
        <CreateAlertRulePanel
          step={step}
          draft={draft}
          channels={channels}
          busy={busy}
          onChange={setDraft}
          onStep={setStep}
          onCreateChannel={createChannel}
          submitLabel={ruleId ? "Save alert" : "Create alert"}
          onSubmit={() => void submit()}
        />
        {error ? <p className="px-4 pb-3 text-xs text-fg-muted">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function toChoice(row: AlertChannelRow): AlertChannelChoice {
  const provider = (["slack", "discord", "telegram", "email", "webhook"] as const).includes(
    row.provider as ChannelProvider,
  )
    ? (row.provider as ChannelProvider)
    : "webhook";
  return { id: row.id, provider, label: row.label, enabled: row.is_enabled };
}
