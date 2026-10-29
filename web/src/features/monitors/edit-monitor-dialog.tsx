import { useEffect, useState } from "react";
import {
  EditMonitorPanel,
  draftFromMonitor,
  draftToSchedule,
  type CreateMonitorDraft,
} from "@/components/kit/create-monitor";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { updateMonitor, type MonitorItem } from "@/lib/api";
import { scheduleToStorage } from "./schedule";

export interface EditMonitorDialogProps {
  open: boolean;
  monitor: MonitorItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (monitor: MonitorItem) => void;
}

export function EditMonitorDialog({
  open,
  monitor,
  onOpenChange,
  onSaved,
}: EditMonitorDialogProps) {
  const [draft, setDraft] = useState<CreateMonitorDraft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !monitor) {
      setDraft(null);
      return;
    }
    setDraft(draftFromMonitor(monitor));
    setBusy(false);
  }, [open, monitor]);

  async function handleSave() {
    if (!monitor || !draft) return;
    setBusy(true);
    try {
      const schedule = draftToSchedule(draft);
      const updated = await updateMonitor(monitor.id, {
        name: draft.name.trim(),
        schedule: scheduleToStorage(schedule),
        schedule_type: schedule.type,
        timezone: draft.timezone,
        environment: draft.environment === "all" ? undefined : draft.environment,
        checkin_margin_mins: draft.checkinMarginMins,
        max_runtime_mins: draft.maxRuntimeMins,
        failure_issue_threshold: draft.failureIssueThreshold,
      });
      onSaved({
        ...updated,
        recent_check_ins: monitor.recent_check_ins ?? updated.recent_check_ins,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[min(calc(100vw-2rem),30rem)] max-h-[min(calc(100dvh-3rem),36rem)] overflow-hidden p-0 sm:w-[min(calc(100vw-3rem),32rem)] sm:max-w-none">
        <DialogTitle className="sr-only">Edit monitor</DialogTitle>
        {draft ? (
          <EditMonitorPanel
            draft={draft}
            busy={busy}
            onChange={setDraft}
            onCancel={() => onOpenChange(false)}
            onSave={() => void handleSave()}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
