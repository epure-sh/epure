import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function sidebarNavItemClass(active: boolean, className?: string) {
  return cn(
    "relative flex min-h-7 items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-100 focus-ring select-none",
    active
      ? "bg-accent-muted font-semibold text-fg-primary"
      : "text-fg-muted hover:bg-state-hover hover:text-fg-primary",
    className,
  );
}

export function sidebarNavIconClass(active: boolean) {
  return cn("relative z-10 shrink-0", active ? "text-accent" : "text-fg-muted");
}

export interface SidebarNavLinkProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  onClick?: () => void;
  /** Extra path match (e.g. issue detail under /issues). */
  isAlsoActive?: (pathname: string, navIsActive: boolean) => boolean;
  badge?: ReactNode;
  dataTour?: string;
}

export function SidebarNavLink({
  to,
  label,
  icon: Icon,
  end = true,
  onClick,
  isAlsoActive,
  badge,
  dataTour,
}: SidebarNavLinkProps) {
  const { pathname } = useLocation();

  function resolveActive(navIsActive: boolean) {
    return isAlsoActive ? isAlsoActive(pathname, navIsActive) : navIsActive;
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      data-tour={dataTour}
      className={({ isActive }) => {
        const active = resolveActive(isActive);
        return sidebarNavItemClass(active, badge ? "justify-between" : undefined);
      }}
    >
      {({ isActive }) => {
        const active = resolveActive(isActive);
        return (
          <>
            <span className="relative z-10 flex min-w-0 items-center gap-2">
              <Icon
                size={13}
                strokeWidth={active ? 2.1 : 1.8}
                className={sidebarNavIconClass(active)}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </span>
            {badge ? <span className="relative z-10 shrink-0">{badge}</span> : null}
          </>
        );
      }}
    </NavLink>
  );
}
