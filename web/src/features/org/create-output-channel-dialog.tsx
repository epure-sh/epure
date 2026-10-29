import { useEffect, useMemo, useState } from "react";
import { CreateOutputChannelPanel } from "@/components/kit/create-output-channel";
import {
  draftToCreateBodies,
  emptyOutputChannelDraft,
  type OutputChannelDraft,
  type OutputChannelStep,
} from "@/components/kit/create-output-channel-model";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { copyText } from "@/lib/copy-text";
import {
  apiErrorStatus,
  createAlertChannel,
  fetchMembers,
  fetchProjects,
  testAlertChannel,
  type MemberRow,
  type ProjectRow,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAppContext } from "@/shell/app-context";

export function CreateOutputChannelDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProjectId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  defaultProjectId?: string | null;
}) {
  const { projects: contextProjects, refreshProjects } = useAppContext();
  const [step, setStep] = useState<OutputChannelStep>(1);
  const [draft, setDraft] = useState<OutputChannelDraft>(emptyOutputChannelDraft);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const projectChoices = useMemo(() => {
    const rows = projects.length > 0 ? projects : contextProjects;
    return (Array.isArray(rows) ? rows : []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug ?? undefined,
    }));
  }, [projects, contextProjects]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDraft({
      ...emptyOutputChannelDraft(),
      projectIds: defaultProjectId ? [defaultProjectId] : [],
    });
    setChannelIds([]);
    setSigningSecret(null);
    setVerified(false);
    setTestError(null);
    setLoadError(null);

    // Prefer already-loaded app projects; still refresh + members from the API.
    const cached = contextProjects;
    if (cached.length > 0) {
      setProjects(cached);
    }

    let cancelled = false;
    void Promise.all([fetchProjects(), fetchMembers()])
      .then(async ([projectRows, memberRows]) => {
        if (cancelled) return;
        setProjects(projectRows);
        setMembers(memberRows);
        void refreshProjects().catch(() => undefined);
        setDraft((current) => {
          if (current.projectIds.length > 0) return current;
          if (defaultProjectId) return { ...current, projectIds: [defaultProjectId] };
          if (projectRows.length === 1) {
            return { ...current, projectIds: [projectRows[0]!.id] };
          }
          return current;
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (cached.length > 0) {
          setProjects(cached);
          setMembers([]);
          setLoadError("Could not refresh projects — using cached list.");
        } else {
          setProjects([]);
          setMembers([]);
          setLoadError("Could not load projects or members from the API.");
        }
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when the dialog opens or the default project changes.
    // contextProjects is a cache snapshot on open — intentionally omitted from deps.
  }, [open, defaultProjectId]);

  async function createAndAdvance() {
    if (draft.projectIds.length === 0) {
      toast.error("Select at least one project");
      return;
    }
    setBusy(true);
    setTestError(null);
    try {
      const bodies = draftToCreateBodies(draft);
      const created = [];
      for (const body of bodies) {
        created.push(await createAlertChannel(body));
      }
      setChannelIds(created.map((row) => row.id));
      setSigningSecret(created.find((row) => row.signing_secret)?.signing_secret ?? null);
      setVerified(false);
      setStep(3);
    } catch (err) {
      const status = apiErrorStatus(err);
      toast.error(
        status === 400
          ? "Could not create this channel. Check the URL, token, or recipients."
          : "Could not create this channel.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    if (channelIds.length === 0) {
      setTestError("Create the channel before testing.");
      return;
    }
    setTestBusy(true);
    setTestError(null);
    try {
      const primary = channelIds[0]!;
      const result = await testAlertChannel(primary, { enable_on_ok: true });
      if (result.sent && result.status === "ok") {
        await Promise.all(
          channelIds.slice(1).map((id) =>
            testAlertChannel(id, { enable_on_ok: true }).catch(() => undefined),
          ),
        );
        setVerified(true);
        toast.success(
          channelIds.length > 1
            ? `Test delivered · ${channelIds.length} projects`
            : "Test delivered",
        );
      } else {
        setVerified(false);
        setTestError(result.error || "Test delivery failed");
      }
    } catch (err) {
      setVerified(false);
      setTestError(
        apiErrorStatus(err) === 429
          ? "Too many tests — try again in an hour."
          : "Test delivery failed",
      );
    } finally {
      setTestBusy(false);
    }
  }

  function finish() {
    onCreated?.();
    onOpenChange(false);
    toast.success(verified ? "Output channel connected" : "Output channel saved");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-w-none flex-col overflow-hidden p-0",
          "w-[min(calc(100vw-2rem),32rem)] max-h-[min(calc(100dvh-3rem),38rem)] sm:w-[min(calc(100vw-3rem),34rem)]",
        )}
      >
        <DialogTitle className="sr-only">New output channel</DialogTitle>
        <CreateOutputChannelPanel
          step={step}
          draft={draft}
          projects={projectChoices}
          members={members.map((m) => ({
            email: m.email,
            display_name: m.display_name,
          }))}
          busy={busy}
          testBusy={testBusy}
          verified={verified}
          testError={
            step === 2 && loadError
              ? loadError
              : testError
          }
          signingSecret={signingSecret}
          onChange={setDraft}
          onStep={(next) => {
            if (next < 3) {
              setChannelIds([]);
              setSigningSecret(null);
              setVerified(false);
              setTestError(null);
            }
            setStep(next);
          }}
          onCreateAndVerify={() => void createAndAdvance()}
          onTest={() => void runTest()}
          onFinish={finish}
          onSaveUnverified={finish}
          onCopySecret={() => {
            if (!signingSecret) return;
            void copyText(signingSecret).then((ok) => {
              toast[ok ? "success" : "error"](ok ? "Secret copied" : "Could not copy");
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
