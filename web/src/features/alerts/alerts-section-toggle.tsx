import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/cn";

export type AlertsSection = "history" | "configure";

export interface AlertsSectionToggleProps {
  value: AlertsSection;
  onChange: (value: AlertsSection) => void;
  className?: string;
}

/** Primary Alerts page mode — History (feed) vs Configure (rules). */
export function AlertsSectionToggle({ value, onChange, className }: AlertsSectionToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next === "history" || next === "configure") {
          onChange(next);
        }
      }}
      aria-label="Alerts section"
      className={cn(className)}
    >
      <ToggleGroupItem value="history" aria-label="Alert history">
        History
      </ToggleGroupItem>
      <ToggleGroupItem value="configure" aria-label="Configure alerts">
        Configure
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
