import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  options: FilterOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  onReset?: () => void;
  className?: string;
}

export function FilterBar({
  options,
  activeKey,
  onSelect,
  onReset,
  className,
}: FilterBarProps) {
  const isAll = activeKey === "all" || !activeKey;

  return (
    <div
      data-slot="filter-bar"
      className={cn("flex flex-wrap items-center gap-1.5 py-1", className)}
    >
      <Button
        variant={isAll ? "primary" : "outline"}
        size="xs"
        onClick={() => {
          if (onReset) onReset();
          else onSelect("all");
        }}
      >
        All
      </Button>

      {options.map((option) => {
        const selected = activeKey === option.key;
        return (
          <Button
            key={option.key}
            variant={selected ? "secondary" : "outline"}
            size="xs"
            onClick={() => onSelect(option.key)}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" && (
              <Badge
                variant="neutral"
                size="sm"
                className="h-4 px-1 text-[10px] tabular-nums"
              >
                {option.count}
              </Badge>
            )}
            {selected && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect("all");
                }}
                className="hover:text-fg-primary ml-0.5"
              >
                <X className="size-2.5" weight="bold" />
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
