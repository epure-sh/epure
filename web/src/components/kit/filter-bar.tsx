import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CaretDown,
  MagnifyingGlass,
  Warning,
  Flame,
  X,
  SlidersHorizontal,
  Check,
  Tag,
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  // Legacy / simple segmented bar props:
  options?: FilterOption[];
  activeKey?: string;
  onSelect?: (key: string) => void;
  onReset?: () => void;
  className?: string;

  // Rich Feed FilterBar props (Sprint 4):
  environment?: string;
  onEnvironmentChange?: (env: string) => void;
  status?: string;
  onStatusChange?: (status: string) => void;
  escalating?: boolean;
  onToggleEscalating?: () => void;
  regression?: boolean;
  onToggleRegression?: () => void;
  priority?: string;
  onPriorityChange?: (priority: string) => void;
  release?: string | null;
  releases?: string[];
  onReleaseChange?: (release: string | null) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  searchPlaceholder?: string;
  searchInputRef?: Ref<HTMLInputElement>;
  stats?: {
    unresolved?: number;
    regressions?: number;
    snoozed?: number;
  };
}

export function FilterBar({
  options,
  activeKey,
  onSelect,
  onReset,
  className,
  environment,
  onEnvironmentChange,
  status,
  onStatusChange,
  escalating = false,
  onToggleEscalating,
  regression = false,
  onToggleRegression,
  priority,
  onPriorityChange,
  release,
  releases = [],
  onReleaseChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search issues…",
  searchInputRef,
  stats,
}: FilterBarProps) {
  // If only options are passed, render standard segmented filter bar
  if (options && !environment && !onEnvironmentChange && !search && !onSearchChange) {
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
            else onSelect?.("all");
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
              onClick={() => onSelect?.(option.key)}
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
                    onSelect?.("all");
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

  // Rich Sprint 4 Feed FilterBar
  const isAllActive =
    (!status || status === "all" || status === "unresolved") &&
    !escalating &&
    !regression &&
    !priority &&
    !release &&
    (!search || search.trim() === "");

  return (
    <div
      data-slot="filter-bar"
      className={cn(
        "flex flex-wrap items-center gap-1.5 py-1.5 text-xs select-none",
        className
      )}
    >
      {/* 1. Far-left [All] Reset Button */}
      <Button
        variant={isAllActive ? "primary" : "outline"}
        size="xs"
        className="h-7 text-xs font-medium"
        onClick={() => {
          if (onReset) onReset();
          else {
            onStatusChange?.("unresolved");
            if (escalating && onToggleEscalating) onToggleEscalating();
            if (regression && onToggleRegression) onToggleRegression();
            onPriorityChange?.("");
            onReleaseChange?.(null);
            onSearchChange?.("");
          }
        }}
      >
        All
      </Button>

      {/* 2. Environment Switcher Pill: [Env: production ▾] */}
      {onEnvironmentChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className="h-7 text-xs font-mono font-medium gap-1 text-fg-secondary hover:text-fg-primary"
            >
              <span>Env: {environment || "all"}</span>
              <CaretDown className="size-3 text-fg-muted" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuItem onSelect={() => onEnvironmentChange("production")}>
              <span>production</span>
              {environment === "production" && (
                <Check className="ml-auto size-3" weight="bold" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEnvironmentChange("staging")}>
              <span>staging</span>
              {environment === "staging" && (
                <Check className="ml-auto size-3" weight="bold" />
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEnvironmentChange("local")}>
              <span>local / dev</span>
              {environment === "local" && (
                <Check className="ml-auto size-3" weight="bold" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEnvironmentChange("all")}>
              <span>all environments</span>
              {(!environment || environment === "all") && (
                <Check className="ml-auto size-3" weight="bold" />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 3. Status Filters */}
      {onStatusChange && (
        <>
          <Button
            variant={status === "unresolved" ? "secondary" : "outline"}
            size="xs"
            className="h-7 text-xs gap-1"
            onClick={() => onStatusChange(status === "unresolved" ? "all" : "unresolved")}
          >
            <span>Unresolved</span>
            {typeof stats?.unresolved === "number" && (
              <Badge variant="neutral" size="sm" className="h-4 px-1 text-[10px] tabular-nums">
                {stats.unresolved}
              </Badge>
            )}
          </Button>

          <Button
            variant={status === "resolved" ? "secondary" : "outline"}
            size="xs"
            className="h-7 text-xs"
            onClick={() => onStatusChange(status === "resolved" ? "all" : "resolved")}
          >
            Resolved
          </Button>

          <Button
            variant={status === "snoozed" ? "secondary" : "outline"}
            size="xs"
            className="h-7 text-xs gap-1"
            onClick={() => onStatusChange(status === "snoozed" ? "all" : "snoozed")}
          >
            <span>Snoozed</span>
            {typeof stats?.snoozed === "number" && stats.snoozed > 0 && (
              <Badge variant="neutral" size="sm" className="h-4 px-1 text-[10px] tabular-nums">
                {stats.snoozed}
              </Badge>
            )}
          </Button>
        </>
      )}

      {/* 4. Escalating (3d) Toggle Pill */}
      {onToggleEscalating && (
        <Button
          variant={escalating ? "secondary" : "outline"}
          size="xs"
          className={cn(
            "h-7 text-xs gap-1 font-medium transition-colors",
            escalating
              ? "border-escalating/60 bg-escalating/15 text-escalating"
              : "text-fg-secondary hover:text-fg-primary"
          )}
          onClick={onToggleEscalating}
        >
          <Flame
            className={cn("size-3", escalating ? "text-escalating" : "text-fg-muted")}
            weight={escalating ? "fill" : "bold"}
          />
          <span>Escalating (3d)</span>
        </Button>
      )}

      {/* 5. Came Back (Regression) Toggle Pill */}
      {onToggleRegression && (
        <Button
          variant={regression ? "secondary" : "outline"}
          size="xs"
          className={cn(
            "h-7 text-xs gap-1 font-medium transition-colors",
            regression
              ? "border-warning/60 bg-warning/15 text-warning"
              : "text-fg-secondary hover:text-fg-primary"
          )}
          onClick={onToggleRegression}
        >
          <Warning
            className={cn("size-3", regression ? "text-warning" : "text-fg-muted")}
            weight={regression ? "fill" : "bold"}
          />
          <span>Came Back</span>
          {typeof stats?.regressions === "number" && stats.regressions > 0 && (
            <Badge variant="warning" size="sm" className="h-4 px-1 text-[10px] tabular-nums">
              {stats.regressions}
            </Badge>
          )}
        </Button>
      )}

      {/* 6. Priority Selector */}
      {onPriorityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={priority ? "secondary" : "outline"}
              size="xs"
              className="h-7 text-xs gap-1 text-fg-secondary hover:text-fg-primary"
            >
              <SlidersHorizontal className="size-3 text-fg-muted" weight="bold" />
              <span>{priority ? `Priority: ${priority}` : "Priority"}</span>
              <CaretDown className="size-2.5 text-fg-muted" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuItem onSelect={() => onPriorityChange("")}>
              <span>All priorities</span>
              {!priority && <Check className="ml-auto size-3" weight="bold" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onPriorityChange("critical")}>
              <span className="text-danger font-medium">Critical</span>
              {priority === "critical" && <Check className="ml-auto size-3" weight="bold" />}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPriorityChange("high")}>
              <span className="text-warning font-medium">High</span>
              {priority === "high" && <Check className="ml-auto size-3" weight="bold" />}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPriorityChange("medium")}>
              <span>Medium</span>
              {priority === "medium" && <Check className="ml-auto size-3" weight="bold" />}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPriorityChange("low")}>
              <span className="text-fg-muted">Low</span>
              {priority === "low" && <Check className="ml-auto size-3" weight="bold" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 7. Release Selector */}
      {releases.length > 0 && onReleaseChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={release ? "secondary" : "outline"}
              size="xs"
              className="h-7 text-xs gap-1 font-mono text-fg-secondary hover:text-fg-primary"
            >
              <Tag className="size-3 text-fg-muted" weight="bold" />
              <span>{release ? `Release: ${release}` : "Release"}</span>
              <CaretDown className="size-2.5 text-fg-muted" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 max-h-60 overflow-y-auto">
            <DropdownMenuItem onSelect={() => onReleaseChange(null)}>
              <span>All releases</span>
              {!release && <Check className="ml-auto size-3" weight="bold" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {releases.map((rel) => (
              <DropdownMenuItem key={rel} onSelect={() => onReleaseChange(rel)}>
                <span className="font-mono text-xs">{rel}</span>
                {release === rel && <Check className="ml-auto size-3" weight="bold" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* 8. Text Search Input */}
      {onSearchChange && (
        <div className="w-48 shrink-0">
          <Input
            ref={searchInputRef}
            size="sm"
            leadingIcon={<MagnifyingGlass className="size-3.5" />}
            trailingShortcut="/"
            placeholder={searchPlaceholder}
            aria-label="Search issues"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (search) onSearchChange("");
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
