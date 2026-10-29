import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CaretDown,
  CaretLeft,
  Check,
  Copy,
  DiscordLogo,
  EnvelopeSimple,
  Hash,
  Icon,
  MagnifyingGlass,
  SlackLogo,
  TelegramLogo,
  WebhooksLogo,
  X,
} from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  CHANNEL_PROVIDERS,
  canAdvanceOutputChannel,
  describeOutputChannel,
  type ChannelProvider,
  type MemberChoice,
  type OutputChannelDraft,
  type OutputChannelStep,
  type ProjectChoice,
} from "./create-output-channel-model";

export interface CreateOutputChannelPanelProps {
  step: OutputChannelStep;
  draft: OutputChannelDraft;
  projects?: ProjectChoice[];
  members?: MemberChoice[];
  busy?: boolean;
  testBusy?: boolean;
  verified?: boolean;
  testError?: string | null;
  signingSecret?: string | null;
  onChange: (next: OutputChannelDraft) => void;
  onStep: (step: OutputChannelStep) => void;
  onCreateAndVerify?: () => void;
  onTest?: () => void;
  onFinish?: () => void;
  onSaveUnverified?: () => void;
  onCopySecret?: () => void;
}

const PROVIDER_ICON: Record<ChannelProvider, typeof SlackLogo> = {
  slack: SlackLogo,
  discord: DiscordLogo,
  telegram: TelegramLogo,
  email: EnvelopeSimple,
  webhook: WebhooksLogo,
};

export function CreateOutputChannelPanel({
  step,
  draft,
  projects = [],
  members = [],
  busy = false,
  testBusy = false,
  verified = false,
  testError = null,
  signingSecret = null,
  onChange,
  onStep,
  onCreateAndVerify,
  onTest,
  onFinish,
  onSaveUnverified,
  onCopySecret,
}: CreateOutputChannelPanelProps) {
  const canNext = canAdvanceOutputChannel(step, draft);

  return (
    <section
      data-slot="create-output-channel"
      className="flex max-h-[min(calc(100dvh-3rem),36rem)] w-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-1"
      aria-label={`New output channel, step ${step} of 3`}
    >
      <header className="shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg-primary">
            New output channel
          </h2>
          <p className="font-mono text-2xs tabular-nums text-fg-muted">Step {step} of 3</p>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {([1, 2, 3] as const).map((n) => (
            <span
              key={n}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors",
                n <= step ? "bg-fg-primary/70" : "bg-border-subtle",
              )}
            />
          ))}
        </div>
      </header>

      <div
        key={step}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-4 animate-in fade-in duration-200"
      >
        {step === 1 ? <ProviderStep draft={draft} onChange={onChange} /> : null}
        {step === 2 ? (
          <ConnectStep
            draft={draft}
            projects={projects}
            members={members}
            onChange={onChange}
          />
        ) : null}
        {step === 3 ? (
          <VerifyStep
            draft={draft}
            projects={projects}
            verified={verified}
            testBusy={testBusy}
            testError={testError}
            signingSecret={signingSecret}
            onTest={onTest}
            onCopySecret={onCopySecret}
          />
        ) : null}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle/80 px-6 py-3.5">
        {step === 1 ? (
          <span />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || testBusy}
            onClick={() => onStep((step - 1) as OutputChannelStep)}
          >
            <Icon icon={CaretLeft} size={14} />
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !canNext}
            onClick={() => {
              if (step === 2 && onCreateAndVerify) {
                onCreateAndVerify();
                return;
              }
              onStep((step + 1) as OutputChannelStep);
            }}
          >
            {busy && step === 2 ? "Creating…" : "Next"}
            <Icon icon={CaretDown} size={14} className="-rotate-90" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            {onSaveUnverified ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || testBusy}
                onClick={onSaveUnverified}
              >
                Save unverified
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              disabled={busy || testBusy || !verified}
              onClick={onFinish}
            >
              <Icon icon={Check} size={14} />
              {busy ? "Saving…" : "Finish"}
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}

function ProviderStep({
  draft,
  onChange,
}: {
  draft: OutputChannelDraft;
  onChange: (next: OutputChannelDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-fg-secondary">
        Choose where Epure should deliver alert notifications.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CHANNEL_PROVIDERS.map((provider) => {
          const selected = draft.provider === provider.id;
          const IconComp = PROVIDER_ICON[provider.id];
          return (
            <Button
              key={provider.id}
              type="button"
              variant="outline"
              aria-pressed={selected}
              onClick={() =>
                onChange({
                  ...draft,
                  provider: provider.id,
                  label: draft.label || defaultLabel(provider.id),
                })
              }
              className={cn(
                "relative h-auto min-h-0 w-full flex-col items-start gap-2 whitespace-normal rounded-md! border-2! border-border-subtle bg-surface-2 px-4 py-3.5 pb-8 text-left",
                "hover:border-border-strong hover:bg-surface-2",
                selected && "border-border-strong! bg-surface-2",
              )}
            >
              {selected ? (
                <Icon
                  icon={Check}
                  size={14}
                  className="absolute bottom-2.5 right-2.5 text-fg-primary"
                />
              ) : null}
              <span className="flex w-full flex-col items-start gap-1.5">
                <span className="flex items-center gap-1.5">
                  <Icon icon={IconComp} size={14} className="shrink-0 text-fg-secondary" />
                  <span className="text-[13px] font-medium leading-tight text-fg-primary">
                    {provider.label}
                  </span>
                </span>
                <span className="text-[11px] font-normal leading-snug text-fg-muted">
                  {provider.description}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ConnectStep({
  draft,
  projects,
  members,
  onChange,
}: {
  draft: OutputChannelDraft;
  projects: ProjectChoice[];
  members: MemberChoice[];
  onChange: (next: OutputChannelDraft) => void;
}) {
  const isEmail = draft.provider === "email";
  const isTelegram = draft.provider === "telegram";
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name">
        <Input
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder={
            draft.provider === "slack"
              ? "#production-alerts"
              : draft.provider === "telegram"
                ? "On-call Telegram"
                : draft.provider === "email"
                  ? "On-call email"
                  : "Ops webhook"
          }
        />
      </Field>

      <Field
        label="Projects"
        hint="Attach this destination to one or more projects."
      >
        <ProjectMultiPicker
          projects={projects}
          selectedIds={draft.projectIds}
          onChange={(projectIds) => onChange({ ...draft, projectIds })}
        />
      </Field>

      {isEmail ? (
        <Field
          label="Recipients"
          hint="Org members only — free-typed addresses are rejected."
        >
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border-subtle bg-surface-2 p-2">
            {members.length === 0 ? (
              <p className="px-1 py-2 text-xs text-fg-muted">No members loaded.</p>
            ) : (
              members.map((member) => {
                const checked = draft.recipients.includes(member.email);
                return (
                  <label
                    key={member.email}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface-1"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) => {
                        const on = next === true;
                        onChange({
                          ...draft,
                          recipients: on
                            ? [...draft.recipients, member.email]
                            : draft.recipients.filter((email) => email !== member.email),
                        });
                      }}
                    />
                    <span className="min-w-0 truncate text-xs text-fg-primary">
                      {member.display_name || member.email}
                    </span>
                    {member.display_name ? (
                      <span className="ml-auto truncate font-mono text-2xs text-fg-muted">
                        {member.email}
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </Field>
      ) : isTelegram ? (
        <>
          <Field
            label="Bot token"
            hint="From @BotFather. Stored server-side only — never shown again after create."
          >
            <Input
              type="password"
              value={draft.botToken}
              onChange={(e) => onChange({ ...draft, botToken: e.target.value })}
              placeholder="123456:AA…"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field
            label="Chat id"
            hint="Numeric chat/group id, or @channelusername. Add the bot to the chat first."
          >
            <Input
              value={draft.chatId}
              onChange={(e) => onChange({ ...draft, chatId: e.target.value })}
              placeholder="-100… or @alerts"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </>
      ) : (
        <Field
          label={
            draft.provider === "slack"
              ? "Slack Incoming Webhook URL"
              : draft.provider === "discord"
                ? "Discord webhook URL"
                : "HTTPS endpoint"
          }
          hint="Must be https://. Private / metadata IPs are blocked."
        >
          <Input
            value={draft.url}
            onChange={(e) => onChange({ ...draft, url: e.target.value })}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      )}
    </div>
  );
}

function ProjectMultiPicker({
  projects,
  selectedIds,
  onChange,
}: {
  projects: ProjectChoice[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const selected = projects.filter((project) => selectedIds.includes(project.id));
  const matches = projects.filter((project) => {
    if (selectedIds.includes(project.id)) return false;
    if (!needle) return true;
    return `${project.name} ${project.slug ?? ""}`.toLowerCase().includes(needle);
  });

  function addProject(id: string) {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-2 py-1.5 focus-within:border-border-strong">
        <div className="flex w-full items-center gap-1.5">
          <Icon icon={MagnifyingGlass} size={14} className="shrink-0 text-fg-muted" />
          <Input
            size="auto"
            variant="ghost"
            value={query}
            placeholder={selected.length > 0 ? "Add another project…" : "Search projects"}
            className="h-8 w-full min-w-0 flex-1 border-0! bg-transparent! px-1 text-sm shadow-none! ring-0! focus:ring-0!"
            onFocus={() => setListOpen(true)}
            onBlur={() => setListOpen(false)}
            onChange={(event) => {
              setQuery(event.target.value);
              setListOpen(true);
            }}
          />
        </div>
        {selected.length > 0 ? (
          <div className="flex w-full flex-wrap gap-1.5">
            {selected.map((project) => (
              <Badge key={project.id} size="sm" className="shrink-0 gap-1.5 whitespace-nowrap">
                <span className="whitespace-nowrap">{project.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${project.name}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChange(selectedIds.filter((id) => id !== project.id))}
                >
                  <Icon icon={X} size={12} />
                </Button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {listOpen ? (
        <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-xl border border-border-subtle bg-surface-2 p-1">
          {matches.map((project) => (
            <Button
              key={project.id}
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 px-2"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addProject(project.id)}
            >
              <span className="truncate text-fg-primary">{project.name}</span>
              {project.slug ? (
                <span className="truncate font-mono text-2xs text-fg-muted">{project.slug}</span>
              ) : null}
            </Button>
          ))}
          {matches.length === 0 ? (
            <p className="px-2 py-2 text-xs text-fg-muted">
              {projects.length === 0 ? "No projects available." : "No project matches."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function VerifyStep({
  draft,
  projects,
  verified,
  testBusy,
  testError,
  signingSecret,
  onTest,
  onCopySecret,
}: {
  draft: OutputChannelDraft;
  projects: ProjectChoice[];
  verified: boolean;
  testBusy: boolean;
  testError: string | null;
  signingSecret: string | null;
  onTest?: () => void;
  onCopySecret?: () => void;
}) {
  const selectedProjects = projects.filter((p) => draft.projectIds.includes(p.id));
  const IconComp = draft.provider ? PROVIDER_ICON[draft.provider] : Hash;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-3">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-1">
            <Icon icon={IconComp} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-fg-primary">{describeOutputChannel(draft)}</p>
            <p className="mt-0.5 text-2xs text-fg-muted">
              {selectedProjects.length === 0
                ? "No projects"
                : selectedProjects.length === 1
                  ? selectedProjects[0]!.name
                  : `${selectedProjects.length} projects`}{" "}
              · send a test before enabling
            </p>
            {selectedProjects.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedProjects.map((project) => (
                  <Badge key={project.id} size="compact" variant="neutral">
                    {project.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <Badge
            variant={verified ? "healthy" : testError ? "error" : "neutral"}
            size="compact"
            className="shrink-0"
          >
            {verified ? "Verified" : testError ? "Failed" : "Needs verify"}
          </Badge>
        </div>
      </div>

      {signingSecret ? (
        <div className="rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
              Signing secret · copy once
            </p>
            <Button variant="ghost" size="sm" onClick={onCopySecret}>
              <Icon icon={Copy} size={12} />
              Copy
            </Button>
          </div>
          <p className="mt-1 break-all font-mono text-2xs text-fg-primary">{signingSecret}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={testBusy}
          onClick={onTest}
          className="w-full"
        >
          {testBusy ? "Sending test…" : verified ? "Send another test" : "Send test"}
        </Button>
        {testError ? <p className="text-xs text-danger">{testError}</p> : null}
        {verified ? (
          <p className="text-xs text-fg-muted">
            Delivery succeeded. Finish to keep this channel enabled for alert rules.
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            A successful test is required to enable the channel (or save unverified and enable
            later).
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-fg-muted">{label}</span>
      {children}
      {hint ? <span className="text-2xs text-fg-muted">{hint}</span> : null}
    </div>
  );
}

function defaultLabel(provider: ChannelProvider): string {
  switch (provider) {
    case "slack":
      return "#alerts";
    case "discord":
      return "alerts";
    case "telegram":
      return "On-call";
    case "email":
      return "Team email";
    case "webhook":
      return "Webhook";
  }
}

/** Local UI state helper for controlled parent demos. */
export function useOutputChannelDraft(initial?: Partial<OutputChannelDraft>) {
  return useState<OutputChannelDraft>(() => ({
    provider: null,
    label: "",
    projectIds: [],
    url: "",
    recipients: [],
    botToken: "",
    chatId: "",
    ...initial,
  }));
}
