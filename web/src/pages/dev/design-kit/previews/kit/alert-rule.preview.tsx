import { useState } from "react";
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
  const [channels, setChannels] = useState(SAMPLE_CHANNELS);

  return (
    <PreviewBlock
      id="alert-rule"
      title="Create alert rule"
      description="The three steps, full width. Each one is the live setup."
    >
      <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-8">
        {STEPS.map((step) => (
          <div key={step} className="w-full min-w-0 animate-in fade-in duration-300">
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
