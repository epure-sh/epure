import { useState } from "react";
import { CopyButton } from "../../ui/copy-button";
import { PageShell } from "@/components/kit/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrgUsageSettings } from "./settings/usage";
import { USAGE_TIME_WINDOWS, type UsageTimeWindow } from "./settings/usage-utils";

export function UsagePage() {
  const [window, setWindow] = useState<UsageTimeWindow>("7d");
  const [summary, setSummary] = useState("");

  return (
    <PageShell density="standard">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={window} onValueChange={(value) => setWindow(value as UsageTimeWindow)}>
            <SelectTrigger aria-label="Time range" size="sm" className="w-auto min-w-[9rem]">
              <SelectValue>
                {USAGE_TIME_WINDOWS.find((option) => option.value === window)?.label ??
                  "Last 7 days"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {USAGE_TIME_WINDOWS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
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
        </div>
        <OrgUsageSettings window={window} onSummaryChange={setSummary} />
      </div>
    </PageShell>
  );
}
