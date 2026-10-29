import * as React from "react";
import { MagnifyingGlass, X } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DESIGN_KIT_FOUNDATION_PAGES,
  DESIGN_KIT_KIT_FAMILIES,
  DESIGN_KIT_KIT_META,
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_PRIMITIVE_FAMILIES,
  DESIGN_KIT_PRIMITIVE_META,
  DESIGN_KIT_PRIMITIVE_MODULES,
  kitByFamily,
  primitivesByFamily,
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
  const pad = depth === 1 ? "pl-3" : depth >= 2 ? "pl-5" : "";
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

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-2 pb-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-fg-muted">
      {children}
    </p>
  );
}

function FamilyLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-medium tracking-wide text-fg-muted">
      {children}
    </p>
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

  const foundations = DESIGN_KIT_FOUNDATION_PAGES.filter((page) =>
    match(page.label, page.keywords),
  );

  const primitiveGroups = DESIGN_KIT_PRIMITIVE_FAMILIES.map((family) => ({
    family,
    modules: primitivesByFamily()[family].filter((mod) =>
      match(mod, `${family} ${DESIGN_KIT_PRIMITIVE_META[mod].description}`),
    ),
  })).filter((g) => g.modules.length > 0);

  const kitGroups = DESIGN_KIT_KIT_FAMILIES.map((family) => ({
    family,
    modules: kitByFamily()[family].filter((mod) => {
      const meta = DESIGN_KIT_KIT_META[mod];
      return match(
        mod,
        `${family} ${meta.description} ${(meta.absorbs ?? []).join(" ")}`,
      );
    }),
  })).filter((g) => g.modules.length > 0);

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
          <div>
            <p className="text-sm font-semibold text-fg-primary">Orbit</p>
            <p className="text-[10px] text-fg-muted">Epure Design System</p>
          </div>
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

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
        {foundations.length > 0 ? (
          <div className="space-y-0.5">
            <GroupLabel>Foundations</GroupLabel>
            {foundations.map((page) => (
              <NavLink
                key={page.id}
                href={`#${page.id}`}
                label={page.label}
                active={active === page.id}
                onNavigate={handleSelect}
              />
            ))}
          </div>
        ) : null}

        {primitiveGroups.length > 0 ? (
          <div className="space-y-0.5 border-t border-border-subtle pt-1">
            <GroupLabel>Primitives</GroupLabel>
            {primitiveGroups.map(({ family, modules }) => (
              <div key={family} className="space-y-0.5">
                <FamilyLabel>{family}</FamilyLabel>
                {modules.map((mod) => (
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
          </div>
        ) : null}

        {kitGroups.length > 0 ? (
          <div className="space-y-0.5 border-t border-border-subtle pt-1">
            <GroupLabel>Kit</GroupLabel>
            {kitGroups.map(({ family, modules }) => (
              <div key={family} className="space-y-0.5">
                <FamilyLabel>{family}</FamilyLabel>
                {modules.map((mod) => (
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
          </div>
        ) : null}

        {!q ? (
          <p className="border-t border-border-subtle px-2 pt-2 pb-1 text-[10px] leading-snug text-fg-muted">
            {DESIGN_KIT_PRIMITIVE_MODULES.length} primitives ·{" "}
            {DESIGN_KIT_KIT_MODULES.length} kit ·{" "}
            <kbd className="font-mono">/</kbd> filter ·{" "}
            <kbd className="font-mono">⌘K</kbd> jump
          </p>
        ) : null}
      </div>
    </nav>
  );
}
