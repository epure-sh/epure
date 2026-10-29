import { useState } from "react";
import { AlertRuleListRow } from "@/components/kit/alert-rule-row";
import { Button } from "@/components/ui/button";
import { DotsThree, Icon } from "@/components/ui/icon";
import { CreateAlertRulePanel } from "@/components/kit/create-alert-rule";
import {
  templateDraft,
  type AlertChannelChoice,
  type AlertRuleDraft,
} from "@/components/kit/create-alert-rule-model";
import { PreviewBlock } from "../../shared";

const SAMPLE_CHANNELS: AlertChannelChoice[] = [
  { id: "slack-prod", provider: "slack", label: "#prod-alerts", enabled: true },
  { id: "telegram-oncall", provider: "telegram", label: "On-call", enabled: true },
  { id: "discord-eng", provider: "discord", label: "engineering", enabled: true },
  { id: "email-ops", provider: "email", label: "ops@acme.dev", enabled: true },
  { id: "webhook-signed", provider: "webhook", label: "signed hook", enabled: true },
];

const STEPS = [1, 2, 3] as const;

export default function AlertRulePreview() {
  const [drafts, setDrafts] = useState<Record<number, AlertRuleDraft>>({
    1: templateDraft("production-crash"),
    2: templateDraft("error-spike"),
    3: {
      ...templateDraft("many-users"),
      channelIds: ["slack-prod"],
    },
  });
  const [editDraft, setEditDraft] = useState<AlertRuleDraft>(() => ({
    ...templateDraft("error-spike"),
    channelIds: ["discord-eng"],
  }));
  const [paused, setPaused] = useState(false);
  const [channels, setChannels] = useState(SAMPLE_CHANNELS);

  return (
    <PreviewBlock
      id="alert-rule"
      title="Create alert rule"
      description="Compact setup panel (max height + scroll). Edit mode is a single form."
    >
      <div className="mb-8 w-full min-w-0 overflow-x-auto rounded-lg border border-border-subtle bg-surface-1">
        <AlertRuleListRow
          name="Production crash"
          description="Unhandled exceptions in production"
          duration="30 min"
          lastFired="2h ago"
          channel={{ provider: "slack", label: "#prod-alerts" }}
          onSelectChange={() => undefined}
          onEnabledChange={() => undefined}
          actions={
            <Button variant="ghost" size="icon-xs" aria-label="Actions for Production crash">
              <Icon icon={DotsThree} size={16} />
            </Button>
          }
        />
        <AlertRuleListRow
          name="Error spike"
          description="Volume jump vs the last 5 minutes"
          duration="15 min"
          lastFired="14m ago"
          channel={{ provider: "discord", label: "engineering", extra: 1 }}
          selected
          paused={paused}
          bulkSelected
          selectionActive
          onSelectChange={() => undefined}
          onEnabledChange={(enabled) => setPaused(!enabled)}
          actions={
            <Button variant="ghost" size="icon-xs" aria-label="Actions for Error spike">
              <Icon icon={DotsThree} size={16} />
            </Button>
          }
        />
      </div>
      <div className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-6">
        <div className="overflow-hidden rounded-panel border border-border-subtle">
          <CreateAlertRulePanel
            mode="edit"
            step={2}
            draft={editDraft}
            channels={channels}
            onChange={setEditDraft}
            onStep={() => undefined}
            onCreateChannel={async (input) => {
              const created: AlertChannelChoice = {
                id: `${input.provider}-${channels.length + 1}`,
                provider: input.provider,
                label: input.label,
                enabled: true,
              };
              setChannels((current) => [...current, created]);
              return created;
            }}
            onSubmit={() => undefined}
          />
        </div>
        {STEPS.map((step) => (
          <div
            key={step}
            className="w-full min-w-0 overflow-hidden rounded-panel border border-border-subtle animate-in fade-in duration-300"
          >
            <CreateAlertRulePanel
              step={step}
              draft={drafts[step]}
              channels={channels}
              onChange={(next) => setDrafts((current) => ({ ...current, [step]: next }))}
              onStep={() => undefined}
              onCreateChannel={async (input) => {
                const created: AlertChannelChoice = {
                  id: `${input.provider}-${channels.length + 1}`,
                  provider: input.provider,
                  label: input.label,
                  enabled: true,
                };
                setChannels((current) => [...current, created]);
                return created;
              }}
              onSubmit={() => undefined}
            />
          </div>
        ))}
      </div>
    </PreviewBlock>
  );
}
