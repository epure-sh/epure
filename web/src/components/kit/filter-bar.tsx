// src/components/kit/filter-bar.tsx — Phase 4: Orbit Box chrome (Epure Button/Input/Dropdown kept)
import type { Ref } from "react";
import { Box } from "@polar-sh/orbit/Box";
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
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  searchInputRef?: Ref<HTMLInputElement>;
  stats?: {
    unresolved?: number;
    regressions?: number;
    snoozed?: number;
  };
}

function MenuCheck({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Box as="span" marginLeft="auto" display="inline-flex">
      <Check size={12} weight="bold" />
    </Box>
  );
}

export function FilterBar({
  options,
  activeKey,
  onSelect,
  onReset,
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
  if (options) {
    const isAll = activeKey === "all" || !activeKey;

    return (
      <Box
        data-slot="filter-bar"
        flexWrap="wrap"
        alignItems="center"
        columnGap="xs"
        rowGap="xs"
        paddingVertical="xs">
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
              {option.label}
              {typeof option.count === "number" && (
                <Badge variant="neutral" size="compact">
                  {option.count}
                </Badge>
              )}
              {selected && (
                <Box
                  as="span"
                  role="button"
                  tabIndex={0}
                  marginLeft="xs"
                  color={{ base: "text-secondary", hover: "text-primary" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.("all");
                  }}
                >
                  <X size={10} weight="bold" />
                </Box>
              )}
            </Button>
          );
        })}
      </Box>
    );
  }

  const isAllActive =
    (!status || status === "all" || status === "unresolved") &&
    !escalating &&
    !regression &&
    !priority &&
    !release &&
    (!search || search.trim() === "");

  return (
    <Box
      data-slot="filter-bar"
      flexWrap="wrap"
      alignItems="center"
      columnGap="xs"
      rowGap="xs"
      paddingVertical="s"
      userSelect="none">
      <Button
        variant={isAllActive ? "primary" : "outline"}
        size="xs"
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

      {onEnvironmentChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="xs">
              Env: {environment || "all"}
              <CaretDown size={12} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          {/* Radix menu width — third-party glue, not Orbit layout. */}
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuItem onSelect={() => onEnvironmentChange("production")}>
              production
              <MenuCheck show={environment === "production"} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEnvironmentChange("staging")}>
              staging
              <MenuCheck show={environment === "staging"} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEnvironmentChange("local")}>
              local / dev
              <MenuCheck show={environment === "local"} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEnvironmentChange("all")}>
              all environments
              <MenuCheck show={!environment || environment === "all"} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onStatusChange && (
        <>
          <Button
            variant={status === "unresolved" ? "secondary" : "outline"}
            size="xs"
            onClick={() => onStatusChange(status === "unresolved" ? "all" : "unresolved")}
          >
            Unresolved
            {typeof stats?.unresolved === "number" && (
              <Badge variant="neutral" size="compact">
                {stats.unresolved}
              </Badge>
            )}
          </Button>

          <Button
            variant={status === "resolved" ? "secondary" : "outline"}
            size="xs"
            onClick={() => onStatusChange(status === "resolved" ? "all" : "resolved")}
          >
            Resolved
          </Button>

          <Button
            variant={status === "snoozed" ? "secondary" : "outline"}
            size="xs"
            onClick={() => onStatusChange(status === "snoozed" ? "all" : "snoozed")}
          >
            Snoozed
            {typeof stats?.snoozed === "number" && stats.snoozed > 0 && (
              <Badge variant="neutral" size="compact">
                {stats.snoozed}
              </Badge>
            )}
          </Button>
        </>
      )}

      {onToggleEscalating && (
        <Button
          variant={escalating ? "filterEscalating" : "outline"}
          size="xs"
          onClick={onToggleEscalating}
        >
          <Flame size={12} weight={escalating ? "fill" : "bold"} />
          Escalating (3d)
        </Button>
      )}

      {onToggleRegression && (
        <Button
          variant={regression ? "filterRegression" : "outline"}
          size="xs"
          onClick={onToggleRegression}
        >
          <Warning size={12} weight={regression ? "fill" : "bold"} />
          Came Back
          {typeof stats?.regressions === "number" && stats.regressions > 0 && (
            <Badge variant="warning" size="compact">
              {stats.regressions}
            </Badge>
          )}
        </Button>
      )}

      {onPriorityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={priority ? "secondary" : "outline"} size="xs">
              <SlidersHorizontal size={12} weight="bold" />
              {priority ? `Priority: ${priority}` : "Priority"}
              <CaretDown size={10} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuItem onSelect={() => onPriorityChange("")}>
              All priorities
              <MenuCheck show={!priority} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onPriorityChange("critical")}>
              Critical
              <MenuCheck show={priority === "critical"} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPriorityChange("high")}>
              High
              <MenuCheck show={priority === "high"} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPriorityChange("medium")}>
              Medium
              <MenuCheck show={priority === "medium"} />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPriorityChange("low")}>
              Low
              <MenuCheck show={priority === "low"} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {releases.length > 0 && onReleaseChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={release ? "secondary" : "outline"} size="xs">
              <Tag size={12} weight="bold" />
              {release ? `Release: ${release}` : "Release"}
              <CaretDown size={10} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 max-h-60 overflow-y-auto">
            <DropdownMenuItem onSelect={() => onReleaseChange(null)}>
              All releases
              <MenuCheck show={!release} />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {releases.map((rel) => (
              <DropdownMenuItem key={rel} onSelect={() => onReleaseChange(rel)}>
                {rel}
                <MenuCheck show={release === rel} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onSearchChange && (
        <Box width={192} flexShrink={0}>
          <Input
            ref={searchInputRef}
            size="sm"
            leadingIcon={<MagnifyingGlass size={14} />}
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
        </Box>
      )}
    </Box>
  );
}
