import { useCallback, useEffect, useRef, useState } from "react";
import {
  CreateMonitorPanel,
  canCreateMonitor,
  draftToSchedule,
  emptyMonitorDraft,
} from "@/components/kit/create-monitor";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createMonitor,
  fetchAlertChannels,
  fetchMonitorDetails,
  sendMonitorTestCheckIn,
  type AlertChannelRow,
  type MonitorItem,
} from "@/lib/api";
import { scheduleToStorage } from "./schedule";

export interface CreateMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultEnvironment?: string;
  onCreated: (monitor: MonitorItem) => void;
  onUpdated: (monitor: MonitorItem) => void;
}

export function CreateMonitorDialog({
  open,
  onOpenChange,
  projectId,
  defaultEnvironment = "production",
  onCreated,
  onUpdated,
}: CreateMonitorDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState(() => emptyMonitorDraft(defaultEnvironment));
  const [channels, setChannels] = useState<AlertChannelRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<MonitorItem | null>(null);
  const [listening, setListening] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedMs, setConnectedMs] = useState<number | null>(null);
  const listenStartedAt = useRef<number | null>(null);
  const baselineCheckIn = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDraft(emptyMonitorDraft(defaultEnvironment));
    setCreated(null);
    setListening(false);
    setConnected(false);
    setConnectedMs(null);
    baselineCheckIn.current = null;
    void fetchAlertChannels(projectId)
      .then((rows) => {
        setChannels(rows);
        setDraft((d) => ({
          ...d,
          channelIds: rows.filter((c) => c.is_enabled).map((c) => c.id),
        }));
      })
      .catch(() => setChannels([]));
  }, [open, projectId, defaultEnvironment]);

  useEffect(() => {
    if (!listening || !created || connected) return;
    const id = window.setInterval(() => {
      void fetchMonitorDetails(created.id)
        .then((details) => {
          const at = details.monitor.last_check_in_at;
          if (at && at !== baselineCheckIn.current) {
            const ms =
              listenStartedAt.current != null
                ? performance.now() - listenStartedAt.current
                : null;
            setConnected(true);
            setConnectedMs(ms);
            setListening(false);
            onUpdated({
              ...details.monitor,
              recent_check_ins: details.check_ins.slice().reverse(),
            });
          }
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(id);
  }, [listening, created, connected, onUpdated]);

  const handleCreate = useCallback(async () => {
    if (!canCreateMonitor(draft)) return;
    setBusy(true);
    try {
      const schedule = draftToSchedule(draft);
      const item = await createMonitor({
        project_id: projectId,
        slug: draft.slug.trim(),
        name: draft.name.trim(),
        schedule: scheduleToStorage(schedule),
        schedule_type: schedule.type,
        timezone: draft.timezone,
        environment: draft.environment === "all" ? undefined : draft.environment,
        checkin_margin_mins: draft.checkinMarginMins,
        max_runtime_mins: draft.maxRuntimeMins,
        failure_issue_threshold: draft.failureIssueThreshold,
      });
      setCreated(item);
      baselineCheckIn.current = item.last_check_in_at;
      onCreated({ ...item, recent_check_ins: [] });
      setListening(true);
      listenStartedAt.current = performance.now();
    } finally {
      setBusy(false);
    }
  }, [draft, projectId, onCreated]);

  const handleTest = useCallback(async () => {
    if (!created) return;
    const updated = await sendMonitorTestCheckIn(created.id);
    const ms =
      listenStartedAt.current != null ? performance.now() - listenStartedAt.current : 14;
    setConnected(true);
    setConnectedMs(ms);
    setListening(false);
    onUpdated({ ...updated, recent_check_ins: updated.recent_check_ins ?? [] });
  }, [created, onUpdated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[min(calc(100vw-2rem),32rem)] max-h-[min(calc(100dvh-3rem),38rem)] overflow-hidden p-0 sm:w-[min(calc(100vw-3rem),34rem)] sm:max-w-none">
        <DialogTitle className="sr-only">New cron monitor</DialogTitle>
        <CreateMonitorPanel
          step={step}
          draft={draft}
          channels={channels.map((c) => ({
            id: c.id,
            label: c.label,
            provider: c.provider,
            is_enabled: c.is_enabled,
          }))}
          busy={busy}
          created={Boolean(created)}
          listening={listening}
          connected={connected}
          connectedMs={connectedMs}
          createdSlug={created?.slug}
          projectId={projectId}
          onChange={setDraft}
          onStep={setStep}
          onCreate={() => void handleCreate()}
          onSendTest={() => void handleTest()}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
