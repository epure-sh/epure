import { Icon } from "@/components/ui/icon";
import { getAlertTemplateIcon } from "./alert-kind-visual";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/cn";
import {
  ALERT_TEMPLATE_OPTIONS,
  findAlertTemplate,
  type AlertTemplateOption,
} from "./alert-rule-templates";

export type { RuleKind } from "./alert-template-picker.types";
export type { AlertTemplateOption } from "./alert-rule-templates";
export { ALERT_TEMPLATE_OPTIONS, DEFAULT_ALERT_TEMPLATE_ID, findAlertTemplate, applyAlertTemplate } from "./alert-rule-templates";

export function AlertTemplatePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (template: AlertTemplateOption) => void;
  className?: string;
}) {
  const selected = findAlertTemplate(value);

  return (
    <div className={cn("space-y-3", className)}>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const template = ALERT_TEMPLATE_OPTIONS.find((item) => item.id === next);
          if (template) onChange(template);
        }}
        className="flex flex-col gap-1.5"
      >
        {ALERT_TEMPLATE_OPTIONS.map((item) => {
          const isSelected = value === item.id;
          const TemplateIcon = getAlertTemplateIcon(item.id, item.kind);
          return (
            <label
              key={item.id}
              htmlFor={`alert-template-${item.id}`}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                isSelected
                  ? "border-accent bg-accent-muted"
                  : "border-transparent bg-surface-1 hover:bg-surface-2/50",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    isSelected ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-secondary",
                  )}
                >
                  <Icon icon={TemplateIcon} size={15} weight={isSelected ? "fill" : "regular"} aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="truncate text-sm font-medium text-fg-primary">{item.title}</span>
                    {item.badge ? (
                      <Badge variant={item.badge.variant} size="compact" className="h-4 px-1 text-[10px] uppercase">
                        {item.badge.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate font-mono text-[11px] text-fg-muted">{item.preview}</p>
                </div>
              </div>
              <RadioGroupItem
                id={`alert-template-${item.id}`}
                value={item.id}
                aria-label={item.title}
                className={cn(
                  "size-4 shrink-0 border-border-subtle",
                  isSelected && "border-accent data-[state=checked]:border-accent",
                )}
              />
            </label>
          );
        })}
      </RadioGroup>

      <p className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-xs leading-relaxed text-fg-secondary">
        {selected.rationale}
      </p>
    </div>
  );
}
