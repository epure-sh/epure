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
    2: templateDraft("production-crash"),
    3: {
      ...templateDraft("many-users"),
      channelIds: ["slack-prod", "telegram-oncall"],
    },
  });
  const [channels, setChannels] = useState(SAMPLE_CHANNELS);

  return (
    <PreviewBlock
      id="alert-rule"
      title="Create alert rule"
      description="Three steps side by side. Each panel is the live setup, so sections open and the sentence updates in place."
    >
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`w-[28rem] shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
              index === 1 ? "delay-75" : index === 2 ? "delay-150" : ""
            }`}
          >
            <CreateAlertRulePanel
              step={step}
              draft={drafts[step]}
              channels={channels}
              onChange={(next) => setDrafts((current) => ({ ...current, [step]: next }))}
              onStep={(next) => {
                setDrafts((current) => ({ ...current, [next]: current[step], [step]: current[step] }));
              }}
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
              onPing={async () => "Channel is saved. A real message goes out when the rule matches."}
              onSubmit={() => undefined}
            />
          </div>
        ))}
      </div>
    </PreviewBlock>
  );
}
