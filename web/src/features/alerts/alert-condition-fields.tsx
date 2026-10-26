import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";

const SPIKE_WINDOW_MINUTES = 15;

export type AlertRuleKind = "velocity_spike" | "issue_created" | "regression";

const KIND_OPTIONS: { id: AlertRuleKind; label: string; hint: string }[] = [
  { id: "issue_created", label: "New issue", hint: "First time a fingerprint appears" },
  { id: "velocity_spike", label: "Error spike", hint: "Rate jumps vs prior 15 minutes" },
  { id: "regression", label: "Came back", hint: "Resolved issue returns in a release" },
];

export type AlertLevelFilter = "any" | "error" | "fatal";
export type AlertFirstSeenFilter = "any" | "new";

export interface AlertConditionFieldsProps {
  kind: AlertRuleKind;
  onKindChange: (kind: AlertRuleKind) => void;
  environment: string;
  onEnvironmentChange: (value: string) => void;
  threshold: string;
  onThresholdChange: (value: string) => void;
  minLevel: AlertLevelFilter;
  onMinLevelChange: (value: AlertLevelFilter) => void;
  firstSeen: AlertFirstSeenFilter;
  onFirstSeenChange: (value: AlertFirstSeenFilter) => void;
  summary: string;
  showKindPicker?: boolean;
  className?: string;
}

function FieldSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-md border border-border bg-bg-subtle/60 p-3">
      <div>
        <h4 className="text-xs font-medium text-fg-primary">{title}</h4>
        {description ? <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Step 2 — when / where conditions (PostHog-style grouped fields). */
export function AlertConditionFields({
  kind,
  onKindChange,
  environment,
  onEnvironmentChange,
  threshold,
  onThresholdChange,
  minLevel,
  onMinLevelChange,
  firstSeen,
  onFirstSeenChange,
  summary,
  showKindPicker = true,
  className,
}: AlertConditionFieldsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {showKindPicker ? (
        <FieldSection title="When" description="Choose what should fire this alert.">
          <div className="flex flex-wrap gap-1.5">
            {KIND_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={kind === option.id ? "secondary" : "outline"}
                size="xs"
                onClick={() => onKindChange(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-fg-muted">
            {KIND_OPTIONS.find((option) => option.id === kind)?.hint}
          </p>
        </FieldSection>
      ) : null}

      <FieldSection title="Scope" description="Limit to one environment or leave open for all.">
        <div className="flex flex-wrap gap-2">
          {(["", "production", "staging"] as const).map((preset) => (
            <Button
              key={preset || "all"}
              type="button"
              variant={
                (preset === "" && !environment.trim()) || environment.trim() === preset
                  ? "secondary"
                  : "outline"
              }
              size="xs"
              onClick={() => onEnvironmentChange(preset)}
            >
              {preset === "" ? "All environments" : preset}
            </Button>
          ))}
        </div>
        <Input
          size="sm"
          className="mt-2"
          value={environment}
          placeholder="Or type a custom environment"
          onChange={(event) => onEnvironmentChange(event.target.value)}
          aria-label="Environment"
        />
      </FieldSection>

      <FieldSection
        title="Filters"
        description="Narrow which issues count toward this rule."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[11px] text-fg-muted">
            Issue level
            <Select value={minLevel} onValueChange={(v) => onMinLevelChange(v as AlertLevelFilter)}>
              <SelectTrigger size="sm" className="mt-1 w-full" aria-label="Issue level filter">
                <SelectValue placeholder="Any level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any level</SelectItem>
                <SelectItem value="error">Error and above</SelectItem>
                <SelectItem value="fatal">Fatal only</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block text-[11px] text-fg-muted">
            First seen
            <Select value={firstSeen} onValueChange={(v) => onFirstSeenChange(v as AlertFirstSeenFilter)}>
              <SelectTrigger size="sm" className="mt-1 w-full" aria-label="First seen filter">
                <SelectValue placeholder="Any issue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">New or existing issues</SelectItem>
                <SelectItem value="new">New fingerprints only</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <p className="text-[10px] leading-snug text-fg-muted">
          Filters apply when custom rules match an issue on ingest.
        </p>
      </FieldSection>

      {kind === "velocity_spike" ? (
        <FieldSection
          title="Threshold"
          description="Fire when the rolling 15-minute rate exceeds this percentage vs the previous window."
        >
          <div className="flex items-center gap-2">
            <Input
              size="sm"
              type="number"
              min={1}
              className="w-24 tabular-nums"
              value={threshold}
              onChange={(event) => onThresholdChange(event.target.value)}
              aria-label="Spike threshold percent"
            />
            <span className="text-xs text-fg-muted">% increase</span>
          </div>
        </FieldSection>
      ) : null}

      <FieldSection
        title="Frequency"
        description="How often this rule evaluates and notifies (engine defaults for now)."
      >
        <ul className="space-y-1 text-[11px] leading-snug text-fg-secondary">
          <li>
            {kind === "velocity_spike"
              ? `Rolling window: ${SPIKE_WINDOW_MINUTES} minutes vs previous ${SPIKE_WINDOW_MINUTES} minutes`
              : "Evaluates on each matching event"}
          </li>
          <li>One notification per issue until you acknowledge or mute</li>
          <li>Repeat fires only when conditions match again after a cooldown</li>
        </ul>
      </FieldSection>

      <FieldSection title="Summary" description="Plain-language preview of what will fire.">
        <p className="text-xs leading-relaxed text-fg-secondary">{summary}</p>
      </FieldSection>
    </div>
  );
}
