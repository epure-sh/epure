import { useState } from "react";
import { CreateOutputChannelPanel } from "@/components/kit/create-output-channel";
import {
  emptyOutputChannelDraft,
  type OutputChannelDraft,
  type OutputChannelStep,
} from "@/components/kit/create-output-channel-model";
import { PreviewBlock } from "../../shared";

const PROJECTS = [
  { id: "p1", name: "acme-web", slug: "acme-web" },
  { id: "p2", name: "checkout", slug: "checkout" },
  { id: "p3", name: "mobile", slug: "mobile" },
];

const MEMBERS = [
  { email: "alex@acme.dev", display_name: "Alex" },
  { email: "ops@acme.dev", display_name: "Ops" },
];

export default function OutputChannelPreview() {
  const [step, setStep] = useState<OutputChannelStep>(2);
  const [draft, setDraft] = useState<OutputChannelDraft>(() => ({
    ...emptyOutputChannelDraft(),
    provider: "slack",
    label: "#prod-alerts",
    projectIds: ["p1"],
    url: "https://hooks.slack.com/services/T00/B00/XXX",
  }));
  const [verified, setVerified] = useState(false);

  return (
    <PreviewBlock
      id="output-channel"
      title="Create output channel"
      description="Provider cards use surface-2 on the dialog surface. Projects use search + badge multi-select."
    >
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-panel border border-border-subtle">
        <CreateOutputChannelPanel
          step={step}
          draft={draft}
          projects={PROJECTS}
          members={MEMBERS}
          verified={verified}
          signingSecret={
            step === 3
              ? "whsec_preview_only_copy_once_never_stored_in_client"
              : null
          }
          onChange={setDraft}
          onStep={setStep}
          onCreateAndVerify={() => setStep(3)}
          onTest={() => setVerified(true)}
          onFinish={() => {
            setStep(1);
            setVerified(false);
          }}
          onSaveUnverified={() => {
            setStep(1);
            setVerified(false);
          }}
        />
      </div>
    </PreviewBlock>
  );
}
