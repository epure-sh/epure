import * as React from "react";
import { X } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DESIGN_KIT_FEATURE_UI_GROUPS,
  DESIGN_KIT_FEATURE_UI_FACADES,
} from "./feature-ui-registry";
import {
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_SECTIONS,
  DESIGN_KIT_SECTION_GROUPS,
  DESIGN_KIT_UI_MODULES,
} from "./registry";

function NavLink({
  href,
  label,
  active,
  mono,
  onNavigate,
}: {
  href: string;
  label: string;
  active?: boolean;
  mono?: boolean;
  onNavigate?: (id: string) => void;
}) {
  const id = href.replace("#", "");
  if (onNavigate) {
    return (
      <Button
        variant="ghost"
        size="xs"
        type="button"
        onClick={() => onNavigate(id)}
        className={cn(
          "h-auto justify-start px-2 py-1 text-left font-normal",
          active
            ? "bg-accent-muted font-medium text-fg-primary hover:bg-accent-muted"
            : "text-fg-muted hover:bg-surface-2 hover:text-fg-primary",
          mono ? "font-mono text-[11px]" : "text-xs",
        )}
      >
        {label}
      </Button>
    );
  }
  return (
    <a
      href={href}
      className={`rounded-control px-2 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg-primary ${mono ? "font-mono text-[11px]" : "text-xs"}`}
    >
      {label}
    </a>
  );
}

export function DesignKitNav({
  active,
  onSelect,
  onClose,
  className,
}: {
  active: string;
  onSelect: (id: string) => void;
  onClose?: () => void;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();

  const match = (label: string) => !q || label.toLowerCase().includes(q);

  const uiModules = DESIGN_KIT_UI_MODULES.filter((mod) => match(mod));
  const kitModules = DESIGN_KIT_KIT_MODULES.filter((mod) => match(mod));
  const featureGroups = DESIGN_KIT_FEATURE_UI_GROUPS.map((group) => ({
    ...group,
    modules: group.modules.filter((mod) => match(mod) || match(group.label)),
  })).filter((group) => group.modules.length > 0 || match(group.label));

  const sections = DESIGN_KIT_SECTIONS.filter((section) => match(section.label));

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  return (
    <nav
      aria-label="Design kit sections"
      className={cn(
        "flex max-h-[calc(100dvh-7rem)] flex-col gap-2 overflow-y-auto rounded-panel border border-border-subtle bg-surface-1 p-2 lg:sticky lg:top-0",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Input
          className="min-w-0 flex-1"
        size="sm"
        placeholder="Filter catalog…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
          aria-label="Filter design kit catalog"
        />
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Close catalog"
            onClick={onClose}
          >
            <X size={14} weight="bold" />
          </Button>
        ) : null}
      </div>

      {DESIGN_KIT_SECTION_GROUPS.map((groupName) => {
        const groupSections = sections.filter((section) => section.group === groupName);
        if (groupSections.length === 0) {
          return null;
        }
        return (
          <div key={groupName} className="space-y-0.5">
            <p className="px-2 pt-1 font-mono text-[10px] font-medium uppercase tracking-wide text-fg-muted">
              {groupName}
            </p>
            {groupSections.map((section) => (
              <NavLink
                key={section.id}
                href={`#${section.id}`}
                label={section.label}
                active={active === section.id}
                onNavigate={handleSelect}
              />
            ))}
          </div>
        );
      })}

      {uiModules.length > 0 ? (
        <div className="space-y-0.5 border-t border-border-subtle pt-2">
          <p className="px-2 font-mono text-[10px] uppercase tracking-wide text-fg-muted">
            UI primitives ({uiModules.length})
          </p>
          {uiModules.map((mod) => (
            <NavLink key={mod} href={`#${mod}`} label={mod} mono onNavigate={handleSelect} />
          ))}
        </div>
      ) : null}

      {kitModules.length > 0 ? (
        <div className="space-y-0.5 border-t border-border-subtle pt-2">
          <p className="px-2 font-mono text-[10px] uppercase tracking-wide text-fg-muted">
            Kit ({kitModules.length})
          </p>
          {kitModules.map((mod) => (
            <NavLink key={mod} href={`#${mod}`} label={mod} mono onNavigate={handleSelect} />
          ))}
        </div>
      ) : null}

      {featureGroups.map((group) => (
        <div key={group.id} className="space-y-0.5 border-t border-border-subtle pt-2">
          <Button
            variant="ghost"
            size="xs"
            type="button"
            className="h-auto w-full justify-start rounded-control px-2 py-1 text-left text-[11px] font-medium text-fg-secondary hover:bg-surface-2 hover:text-fg-secondary"
            onClick={() => handleSelect(group.id)}
          >
            {group.label}
            <span className="ml-1 font-mono font-normal text-fg-muted">({group.modules.length})</span>
          </Button>
          {group.modules.map((mod) => (
            <NavLink key={mod} href={`#${mod}`} label={mod} mono onNavigate={handleSelect} />
          ))}
        </div>
      ))}

      {!q ? (
        <p className="border-t border-border-subtle px-2 pt-2 text-[10px] leading-snug text-fg-muted">
          {DESIGN_KIT_FEATURE_UI_FACADES.length} façade modules mirror{" "}
          <code className="font-mono">@/components/ui/*</code> — see UI primitives.
        </p>
      ) : null}
    </nav>
  );
}
