import { useState } from "react";
import { deploymentLabel, isCloudDeployment } from "../../lib/deployment";
import { CopyButton } from "../../ui/copy-button";
import { PageChrome } from "../../ui/page-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { OrgUsageSettings } from "./settings/usage";
import { USAGE_TIME_WINDOWS, type UsageTimeWindow } from "./settings/usage-utils";

export function UsagePage() {
  const [window, setWindow] = useState<UsageTimeWindow>("7d");
  const [summary, setSummary] = useState("");
  const cloud = isCloudDeployment();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Usage"
        description={
          cloud
            ? `Event volume, storage, and plan limits across your ${deploymentLabel().toLowerCase()} workspace.`
            : `Event volume, storage, and retention across your ${deploymentLabel().toLowerCase()} workspace.`
        }
        actions={
          <>
            <Select value={window} onValueChange={(value) => setWindow(value as UsageTimeWindow)}>
              <SelectTrigger aria-label="Time range" className="h-8 w-auto min-w-[9rem] text-xs">
                <SelectValue>
                  {USAGE_TIME_WINDOWS.find((option) => option.value === window)?.label ??
                    "Last 7 days"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {USAGE_TIME_WINDOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CopyButton
              value={summary}
              label="Copy summary"
              className={!summary ? "pointer-events-none opacity-50" : undefined}
            />
          </>
        }
      />
      <div className="min-w-0 flex-1 overflow-auto bg-bg p-4">
        <div className="mx-auto max-w-wide space-y-4">
          <OrgUsageSettings window={window} onSummaryChange={setSummary} />
        </div>
      </div>
    </div>
  );
}
