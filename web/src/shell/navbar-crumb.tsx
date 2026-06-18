import { ChevronDown, Search, type LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared chrome control — compact, no shadow, subtle hover */
const navControl =
  "rounded-md transition-colors focus-ring data-[state=open]:bg-bg-subtle/80";

export function NavSeparator() {
  return (
    <span aria-hidden className="epure-navbar-separator select-none px-0.5 text-xs text-ink-muted/40">
      /
    </span>
  );
}

export interface NavCrumbProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  badge?: ReactNode;
}

export const NavCrumb = forwardRef<HTMLButtonElement, NavCrumbProps>(
  ({ icon: Icon, label, badge, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "epure-navbar-crumb",
        navControl,
        "inline-flex h-8 max-w-[10rem] items-center gap-1 px-1.5 text-xs text-ink hover:bg-bg-subtle/60",
        className,
      )}
      {...props}
    >
      <Icon size={14} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
      <span className="truncate">{label}</span>
      {badge}
      <ChevronDown size={12} className="shrink-0 text-ink-muted/80" />
    </button>
  ),
);
NavCrumb.displayName = "NavCrumb";

export interface NavSearchPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  shortcut?: ReactNode;
}

export const NavSearchPill = forwardRef<HTMLButtonElement, NavSearchPillProps>(
  ({ className, shortcut, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "epure-navbar-search",
        navControl,
        "inline-flex h-8 w-[9rem] items-center gap-1.5 border border-border-strong bg-transparent px-2 text-xs text-ink-muted hover:border-border-strong hover:bg-bg-subtle/40",
        className,
      )}
      {...props}
    >
      <Search size={12} strokeWidth={2} className="shrink-0 opacity-70" />
      <span className="flex-1 truncate text-left">Search…</span>
      {shortcut}
    </button>
  ),
);
NavSearchPill.displayName = "NavSearchPill";

export interface NavIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export const NavIconButton = forwardRef<HTMLButtonElement, NavIconButtonProps>(
  ({ label, children, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "epure-navbar-icon-button",
        navControl,
        "inline-flex h-8 w-8 shrink-0 items-center justify-center text-ink-muted hover:bg-bg-subtle/60 hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
NavIconButton.displayName = "NavIconButton";
