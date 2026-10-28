import { useState } from "react";
import { Icon, MagnifyingGlass } from "@/components/ui/icon";
import { getAlertTemplateIcon } from "./alert-kind-visual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  ALERT_TEMPLATE_OPTIONS,
  findAlertTemplate,
  type AlertTemplateOption,
} from "./alert-rule-templates";

export type { RuleKind } from "./alert-template-picker.types";
export type { AlertTemplateOption } from "./alert-rule-templates";
export { ALERT_TEMPLATE_OPTIONS, DEFAULT_ALERT_TEMPLATE_ID, findAlertTemplate, applyAlertTemplate } from "./alert-rule-templates";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "recommended", label: "Recommended" },
  { id: "spikes", label: "Rate & spikes" },
  { id: "new", label: "New & regressions" },
  { id: "custom", label: "Custom / Agent" },
] as const;

export function AlertTemplatePicker({
  value,
  onChange,
  onPickAndContinue,
  className,
}: {
  value: string;
  onChange: (template: AlertTemplateOption) => void;
  onPickAndContinue?: (template: AlertTemplateOption) => void;
  className?: string;
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]["id"]>("all");
  const selected = findAlertTemplate(value);

  const filteredOptions = ALERT_TEMPLATE_OPTIONS.filter((item) => {
    if (activeCategory === "recommended") {
      if (item.id !== "prod-spike" && item.id !== "prod-users" && item.id !== "prod-new") return false;
    } else if (activeCategory === "spikes") {
      if (item.kind !== "velocity_spike") return false;
    } else if (activeCategory === "new") {
      if (item.kind !== "issue_created" && item.kind !== "regression") return false;
    } else if (activeCategory === "custom") {
      if (item.id !== "custom-agent") return false;
    }

    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.preview.toLowerCase().includes(q) ||
      item.rationale.toLowerCase().includes(q) ||
      (item.badge?.label.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Compact search & category filter */}
      <div className="flex flex-col gap-1.5">
        <div className="relative flex items-center">
          <Icon
            icon={MagnifyingGlass}
            size={13}
            className="pointer-events-none absolute left-2.5 text-fg-muted"
            aria-hidden
          />
          <Input
            size="sm"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search templates or triggers..."
            className="h-7 pl-7 font-mono text-[11px]"
            aria-label="Filter templates"
          />
          {filterQuery ? (
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              onClick={() => setFilterQuery("")}
              className="absolute right-1 size-5 text-xs text-fg-muted hover:text-fg-primary"
              aria-label="Clear filter"
            >
              ×
            </Button>
          ) : null}
        </div>

        {/* Minimal Category Pills */}
        <div className="flex flex-wrap items-center gap-1 font-mono text-[10px]">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <Button
                key={cat.id}
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "h-auto rounded px-2 py-0.5 transition-colors font-mono text-[10px] font-normal",
                  isActive
                    ? "bg-accent-muted font-semibold text-fg-primary hover:bg-accent-muted"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg-secondary",
                )}
              >
                {cat.label}
              </Button>
            );
          })}
        </div>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const template = ALERT_TEMPLATE_OPTIONS.find((item) => item.id === next);
          if (template) onChange(template);
        }}
        className="flex flex-col gap-1"
      >
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-xs text-fg-muted">
            No templates match "{filterQuery}".
          </div>
        ) : (
          filteredOptions.map((item) => {
            const isSelected = value === item.id;
            const TemplateIcon = getAlertTemplateIcon(item.id, item.kind);
            return (
              <label
                key={item.id}
                htmlFor={`alert-template-${item.id}`}
                onDoubleClick={() => onPickAndContinue?.(item)}
                className={cn(
                  "group relative flex cursor-pointer items-center justify-between gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors",
                  isSelected
                    ? "border-accent/80 bg-accent-muted/40 text-fg-primary"
                    : "border-border-subtle/40 bg-surface-1 hover:border-border-subtle hover:bg-surface-2/40",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded",
                      isSelected ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted group-hover:text-fg-secondary",
                    )}
                  >
                    <Icon icon={TemplateIcon} size={13} weight={isSelected ? "fill" : "regular"} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-fg-primary leading-none">
                        {item.title}
                      </span>
                      {item.badge ? (
                        <Badge
                          variant={item.badge.variant}
                          size="compact"
                          className="h-3.5 px-1 font-mono text-[9px] uppercase tracking-wide"
                        >
                          {item.badge.label}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-[10px] text-fg-muted leading-tight mt-0.5">
                      {item.preview}
                    </p>
                  </div>
                </div>
                <RadioGroupItem
                  id={`alert-template-${item.id}`}
                  value={item.id}
                  aria-label={item.title}
                  className={cn(
                    "size-3.5 shrink-0 border-border-subtle",
                    isSelected && "border-accent data-[state=checked]:border-accent",
                  )}
                />
              </label>
            );
          })
        )}
      </RadioGroup>

      {/* Rationale micro-card */}
      <div className="rounded border border-border-subtle/60 bg-surface-2/30 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-fg-muted flex items-start gap-1.5">
        <span className="text-fg-secondary font-semibold shrink-0">Why:</span>
        <span className="text-fg-secondary/90">{selected.rationale}</span>
      </div>
    </div>
  );
}
