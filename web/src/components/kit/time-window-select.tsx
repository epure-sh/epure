import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTimeWindowShortLabel } from "@/lib/time-window";

export interface TimeWindowSelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface TimeWindowSelectProps<T extends string = string> {
  value: T;
  options: ReadonlyArray<TimeWindowSelectOption<T>>;
  onValueChange: (value: T) => void;
  ariaLabel?: string;
  formatShortLabel?: (value: T) => string;
}

/** Compact horizon picker — same control as Issues feed toolbar. */
export function TimeWindowSelect<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel = "Time range",
  formatShortLabel = (v) => getTimeWindowShortLabel(v),
}: TimeWindowSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
      <SelectTrigger aria-label={ariaLabel} className="h-7 w-auto min-w-[4.25rem] text-xs">
        <SelectValue>{formatShortLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
