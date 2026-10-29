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
import { cn } from "@/lib/cn";

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
  const editing = Boolean(ruleId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<AlertRuleDraft>(() => templateDraft("production-crash"));
  const [channels, setChannels] = useState<AlertChannelChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(editing ? 2 : 1);
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
  }, [open, projectId, ruleId, editing]);

  async function createChannel(input: { provider: ChannelProvider; label: string }) {
    if (!projectId) return null;
    const row = await createAlertChannel({
      project_id: projectId,
      provider: input.provider,
      label: input.label,
      require_verify: false,
    });
    const choice = toChoice({
      id: row.id,
      org_id: row.org_id,
      project_id: row.project_id,
      provider: row.provider,
      label: row.label,
      is_enabled: row.is_enabled,
      last_error: row.last_error,
      created_at: row.created_at,
    });
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
      <DialogContent
        className={cn(
          "flex max-w-none flex-col overflow-hidden p-0",
          editing
            ? "w-[min(calc(100vw-2rem),30rem)] max-h-[min(calc(100dvh-3rem),38rem)] sm:w-[min(calc(100vw-3rem),32rem)]"
            : "w-[min(calc(100vw-2rem),32rem)] max-h-[min(calc(100dvh-3rem),38rem)] sm:w-[min(calc(100vw-3rem),34rem)]",
        )}
      >
        <DialogTitle className="sr-only">{editing ? "Edit alert" : "New alert"}</DialogTitle>
        <CreateAlertRulePanel
          mode={editing ? "edit" : "create"}
          step={step}
          draft={draft}
          channels={channels}
          busy={busy}
          onChange={setDraft}
          onStep={setStep}
          onCreateChannel={createChannel}
          submitLabel={editing ? "Save" : "Create"}
          onSubmit={() => void submit()}
        />
        {error ? (
          <p className="shrink-0 border-t border-border-subtle/80 px-6 py-2.5 text-xs text-fg-muted">
            {error}
          </p>
        ) : null}
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
