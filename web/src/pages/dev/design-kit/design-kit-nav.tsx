import * as React from "react";
import { MagnifyingGlass, X } from "@/components/ui/icon";
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
  depth = 0,
  onNavigate,
}: {
  href: string;
  label: string;
  active?: boolean;
  mono?: boolean;
  depth?: number;
  onNavigate?: (id: string) => void;
}) {
  const id = href.replace("#", "");
  const pad = depth > 0 ? "pl-4" : "";
  if (onNavigate) {
    return (
      <Button
        variant="ghost"
        size="xs"
        type="button"
        onClick={() => onNavigate(id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "h-auto w-full justify-start px-2 py-1 text-left font-normal",
          pad,
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
      className={cn(
        "rounded-control px-2 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg-primary",
        pad,
        mono ? "font-mono text-[11px]" : "text-xs",
      )}
    >
      {label}
    </a>
  );
}

export function DesignKitNav({
  active,
  onSelect,
  onClose,
  onOpenSearch,
  className,
}: {
  active: string;
  onSelect: (id: string) => void;
  onClose?: () => void;
  onOpenSearch?: () => void;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const filterRef = React.useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  const match = (label: string, extra = "") =>
    !q || `${label} ${extra}`.toLowerCase().includes(q);

  const uiModules = DESIGN_KIT_UI_MODULES.filter((mod) => match(mod, "ui primitive"));
  const kitModules = DESIGN_KIT_KIT_MODULES.filter((mod) => match(mod, "kit"));
  const featureGroups = DESIGN_KIT_FEATURE_UI_GROUPS.map((group) => ({
    ...group,
    modules: group.modules.filter((mod) => match(mod) || match(group.label)),
  })).filter((group) => group.modules.length > 0 || match(group.label));

  const sections = DESIGN_KIT_SECTIONS.filter(
    (section) => match(section.label, section.keywords ?? ""),
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose?.();
  };

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        const t = event.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
          return;
        }
        event.preventDefault();
        filterRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav
      aria-label="Design kit catalog"
      className={cn(
        "flex h-full min-h-0 flex-col gap-0 overflow-hidden border-border-subtle bg-surface-1",
        className,
      )}
    >
      <div className="shrink-0 space-y-2 border-b border-border-subtle p-2">
        <div className="flex items-center justify-between gap-1 px-1">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            Registry
          </p>
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
        <p className="rounded-control px-2 py-1.5 font-mono text-[10px] leading-snug text-fg-muted">
          Canonical live reference · /__design
        </p>
        <Input
          ref={filterRef}
          className="min-w-0"
          size="sm"
          placeholder="Filter…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Filter design kit catalog"
          leadingIcon={<MagnifyingGlass size={14} weight="bold" />}
          trailingShortcut="/"
        />
        {onOpenSearch ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-7 w-full justify-between font-normal text-fg-muted"
            onClick={onOpenSearch}
          >
            <span className="text-xs">Jump anywhere</span>
            <kbd className="font-mono text-[10px] text-fg-muted">⌘K</kbd>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2">
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
                <div key={section.id} className="space-y-0.5">
                  <NavLink
                    href={`#${section.id}`}
                    label={section.label}
                    active={active === section.id}
                    onNavigate={handleSelect}
                  />
                  {section.id === "primitives" && uiModules.length > 0 ? (
                    <div className="mt-0.5 ml-2 space-y-0.5 border-l border-border-subtle pl-1">
                      {uiModules.map((mod) => (
                        <NavLink
                          key={mod}
                          href={`#${mod}`}
                          label={mod}
                          mono
                          depth={1}
                          active={active === mod}
                          onNavigate={handleSelect}
                        />
                      ))}
                    </div>
                  ) : null}
                  {section.id === "kit" && kitModules.length > 0 ? (
                    <div className="mt-0.5 ml-2 space-y-0.5 border-l border-border-subtle pl-1">
                      {kitModules.map((mod) => (
                        <NavLink
                          key={mod}
                          href={`#${mod}`}
                          label={mod}
                          mono
                          depth={1}
                          active={active === mod}
                          onNavigate={handleSelect}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}

        {featureGroups.map((group) => (
          <div key={group.id} className="space-y-0.5 border-t border-border-subtle pt-2">
            <Button
              variant="ghost"
              size="xs"
              type="button"
              className={cn(
                "h-auto w-full justify-start rounded-control px-2 py-1 text-left text-[11px] font-medium hover:bg-surface-2",
                active === group.id ? "bg-accent-muted text-fg-primary" : "text-fg-secondary",
              )}
              onClick={() => handleSelect(group.id)}
            >
              {group.label}
              <span className="ml-1 font-mono font-normal text-fg-muted">
                ({group.modules.length})
              </span>
            </Button>
            {group.modules.map((mod) => (
              <NavLink
                key={mod}
                href={`#${mod}`}
                label={mod}
                mono
                depth={1}
                active={active === mod}
                onNavigate={handleSelect}
              />
            ))}
          </div>
        ))}

        {!q ? (
          <p className="border-t border-border-subtle px-2 pt-2 pb-1 text-[10px] leading-snug text-fg-muted">
            {DESIGN_KIT_FEATURE_UI_FACADES.length} façade modules mirror{" "}
            <code className="font-mono">@/components/ui/*</code>. Press{" "}
            <kbd className="font-mono">/</kbd> to filter · <kbd className="font-mono">⌘K</kbd> to
            jump.
          </p>
        ) : null}
      </div>
    </nav>
  );
}
