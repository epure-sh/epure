import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/cn";
import { AlertWizardSection } from "./alert-wizard-section";
import type { RuleKind } from "./alert-template-picker.types";

const SPIKE_WINDOW_MINUTES = 15;

export type AlertRuleKind = RuleKind;

const KIND_OPTIONS: { id: AlertRuleKind; label: string; hint: string }[] = [
  { id: "velocity_spike", label: "Error spike", hint: "Rate jumps vs prior 15 minutes" },
  { id: "issue_created", label: "New issue", hint: "First time a fingerprint appears" },
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
  customQuery?: string;
  onCustomQueryChange?: (value: string) => void;
  cooldownMinutes?: number | null;
  onCooldownMinutesChange?: (value: number | null) => void;
  summary: string;
  showKindPicker?: boolean;
  className?: string;
}

function TriggerLogicLine({
  kind,
  threshold,
  onThresholdChange,
}: {
  kind: AlertRuleKind;
  threshold: string;
  onThresholdChange: (value: string) => void;
}) {
  const chip = "rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg-primary";

  if (kind === "velocity_spike") {
    const pct = threshold.trim() || "300";
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-fg-secondary">
        <span>Notify when</span>
        <span className={chip}>spike &gt; {pct}%</span>
        <span>vs prior</span>
        <span className={chip}>{SPIKE_WINDOW_MINUTES}m window</span>
        <label className="sr-only" htmlFor="alert-spike-threshold-inline">
          Spike threshold percent
        </label>
        <Input
          id="alert-spike-threshold-inline"
          size="sm"
          type="number"
          min={1}
          className="h-6 w-16 tabular-nums font-mono text-xs"
          value={threshold}
          onChange={(event) => onThresholdChange(event.target.value)}
        />
      </div>
    );
  }

  if (kind === "regression") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-fg-secondary">
        <span>Notify when</span>
        <span className={chip}>resolved status reoccurs</span>
        <span>in a new build</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-fg-secondary">
      <span>Notify when</span>
      <span className={chip}>first seen fingerprint</span>
      <span>appears in ingest</span>
    </div>
  );
}

/** Step 2 — compact Stitch-style fields. */
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
  customQuery,
  onCustomQueryChange,
  cooldownMinutes,
  onCooldownMinutesChange,
  summary: _summary,
  showKindPicker = true,
  className,
}: AlertConditionFieldsProps) {
  const [scopeEditorOpen, setScopeEditorOpen] = useState(false);
  const [customQueryOpen, setCustomQueryOpen] = useState(Boolean(customQuery && customQuery.trim()));
  const envTrimmed = environment.trim();
  const scopeLabel = envTrimmed ? (envTrimmed.includes(":") ? envTrimmed : `env:${envTrimmed}`) : null;
  const workloadCount = scopeLabel ? 1 : 0;

  return (
    <div className={cn("space-y-2.5", className)}>
      {showKindPicker ? (
        <AlertWizardSection title="When">
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(value) => {
              if (
                value === "velocity_spike" ||
                value === "issue_created" ||
                value === "regression"
              ) {
                onKindChange(value);
              }
            }}
            className="flex-wrap"
          >
            {KIND_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.id} value={option.id} size="sm">
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </AlertWizardSection>
      ) : null}

      <AlertWizardSection title="Trigger logic">
        <div className="rounded-lg bg-surface-2/50 px-2.5 py-2">
          <TriggerLogicLine kind={kind} threshold={threshold} onThresholdChange={onThresholdChange} />
        </div>
      </AlertWizardSection>

      <AlertWizardSection
        title="Target scope"
        actions={
          workloadCount > 0 ? (
            <span className="font-mono text-[10px] tabular-nums text-fg-muted">{workloadCount} workload</span>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {scopeLabel ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-fg-primary">
              {scopeLabel.startsWith("env:production") ? (
                <span className="size-1.5 rounded-full bg-semantic-danger" aria-hidden />
              ) : null}
              {scopeLabel}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="ml-0.5 size-5 min-w-5 text-fg-muted hover:text-semantic-danger"
                aria-label="Remove scope filter"
                onClick={() => onEnvironmentChange("")}
              >
                ×
              </Button>
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="h-6 gap-0.5 px-2 font-mono text-[10px]"
            onClick={() => setScopeEditorOpen((open) => !open)}
          >
            + Add
          </Button>
        </div>
        {scopeEditorOpen || !scopeLabel ? (
          <div className="mt-1.5 space-y-1.5">
            <ToggleGroup
              type="single"
              value={
                envTrimmed === "" ? "all" : envTrimmed === "production" || envTrimmed === "staging" ? envTrimmed : undefined
              }
              onValueChange={(value) => {
                if (value === "all") onEnvironmentChange("");
                else if (value === "production" || value === "staging") {
                  onEnvironmentChange(value);
                  setScopeEditorOpen(false);
                }
              }}
              className="flex-wrap"
            >
              <ToggleGroupItem value="all" size="sm">
                All envs
              </ToggleGroupItem>
              <ToggleGroupItem value="production" size="sm">
                production
              </ToggleGroupItem>
              <ToggleGroupItem value="staging" size="sm">
                staging
              </ToggleGroupItem>
            </ToggleGroup>
            <Input
              size="sm"
              className="h-7 font-mono text-[11px]"
              value={environment}
              placeholder="env:production or custom"
              onChange={(event) => onEnvironmentChange(event.target.value)}
              aria-label="Environment"
            />
          </div>
        ) : null}
      </AlertWizardSection>

      <AlertWizardSection title="Conditions (and)">
        <ul className="flex flex-col gap-1">
          <li className="flex items-center justify-between gap-2 rounded-lg bg-surface-2/50 px-2.5 py-1.5 font-mono text-[11px]">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-fg-primary">
              <span className="text-fg-muted">Level</span>
              <span className="text-fg-muted">==</span>
              {minLevel === "error" ? (
                <Badge variant="escalating" size="compact" className="font-semibold uppercase">
                  error
                </Badge>
              ) : minLevel === "fatal" ? (
                <Badge variant="escalating" size="compact" className="font-semibold uppercase">
                  fatal
                </Badge>
              ) : (
                <span className="text-fg-muted">any</span>
              )}
            </div>
            <Select value={minLevel} onValueChange={(v) => onMinLevelChange(v as AlertLevelFilter)}>
              <SelectTrigger size="sm" className="h-6 w-[5.5rem] border-0 bg-surface-1 px-1.5 text-[10px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="error">error</SelectItem>
                <SelectItem value="fatal">fatal</SelectItem>
              </SelectContent>
            </Select>
          </li>
          <li className="flex items-center justify-between gap-2 rounded-lg bg-surface-2/50 px-2.5 py-1.5 font-mono text-[11px]">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-fg-primary">
              <span className="text-fg-muted">First seen</span>
              <span className="text-fg-muted">==</span>
              <span>{firstSeen === "new" ? "new only" : "any"}</span>
            </div>
            <Select value={firstSeen} onValueChange={(v) => onFirstSeenChange(v as AlertFirstSeenFilter)}>
              <SelectTrigger size="sm" className="h-6 w-[5.5rem] border-0 bg-surface-1 px-1.5 text-[10px]">
                <SelectValue placeholder="First seen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="new">New only</SelectItem>
              </SelectContent>
            </Select>
          </li>
        </ul>
      </AlertWizardSection>

      {/* Custom Tag Query / MCP Agent Filters */}
      {customQueryOpen || Boolean(customQuery) ? (
        <AlertWizardSection title="Custom search query & tags (Agent / MCP)">
          <div className="space-y-1.5">
            <Input
              size="sm"
              className="h-7 font-mono text-[11px]"
              value={customQuery ?? ""}
              placeholder="e.g. tag:service:payment handled:no release:v2.1*"
              onChange={(e) => onCustomQueryChange?.(e.target.value)}
              aria-label="Custom query"
            />
            <p className="text-[11px] text-fg-muted">
              Matches any Epure search syntax, logger, or tag pair. AI agents can configure this directly via MCP.
            </p>
          </div>
        </AlertWizardSection>
      ) : (
        <div className="pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-1 font-mono text-[10px] text-fg-muted hover:text-fg-primary"
            onClick={() => setCustomQueryOpen(true)}
          >
            <span>+ Add custom query filter (MCP)</span>
          </Button>
        </div>
      )}

      {/* Frequency & Cooldown */}
      <AlertWizardSection title="Alert frequency & cooldown">
        <RadioGroup
          value={String(cooldownMinutes ?? 0)}
          onValueChange={(val) => onCooldownMinutesChange?.(Number(val) || null)}
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 font-mono text-[11px]"
        >
          <label className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors border",
            (cooldownMinutes ?? 0) === 0 ? "border-accent/60 bg-accent-muted/40" : "border-border-subtle bg-surface-2/30 hover:bg-surface-2/60"
          )}>
            <RadioGroupItem value="0" id="freq-0" className="size-3.5" />
            <span className="font-medium text-fg-primary">Once</span>
          </label>
          <label className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors border",
            cooldownMinutes === 15 ? "border-accent/60 bg-accent-muted/40" : "border-border-subtle bg-surface-2/30 hover:bg-surface-2/60"
          )}>
            <RadioGroupItem value="15" id="freq-15" className="size-3.5" />
            <span className="font-medium text-fg-primary">15m delay</span>
          </label>
          <label className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors border",
            cooldownMinutes === 30 ? "border-accent/60 bg-accent-muted/40" : "border-border-subtle bg-surface-2/30 hover:bg-surface-2/60"
          )}>
            <RadioGroupItem value="30" id="freq-30" className="size-3.5" />
            <span className="font-medium text-fg-primary">30m delay</span>
          </label>
          <label className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors border",
            cooldownMinutes === 60 ? "border-accent/60 bg-accent-muted/40" : "border-border-subtle bg-surface-2/30 hover:bg-surface-2/60"
          )}>
            <RadioGroupItem value="60" id="freq-60" className="size-3.5" />
            <span className="font-medium text-fg-primary">1h delay</span>
          </label>
        </RadioGroup>
      </AlertWizardSection>
    </div>
  );
}
