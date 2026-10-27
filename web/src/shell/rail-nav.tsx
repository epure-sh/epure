import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { sidebarNavItemClass, sidebarNavIconClass } from "./sidebar-nav-link";
import { NavCountPastille } from "@/components/kit/nav-count-pastille";
import { cn } from "@/lib/utils";
import { RailAccountFooter } from "./rail-account";

export interface RailNavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
  /** Unresolved / unread count for sidebar pastille. */
  badgeCount?: number | null;
  badgeTone?: "neutral" | "accent";
  badgeAriaLabel?: string;
  /** Static rail label (e.g. Cloud on self-hosted billing). */
  badgeLabel?: string;
}

export interface RailExternalLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function RailNav({
  ariaLabel,
  sectionLabel,
  items,
  header,
  externalLinks,
}: {
  ariaLabel: string;
  sectionLabel?: string;
  items: RailNavItem[];
  header?: ReactNode;
  externalLinks?: RailExternalLink[];
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="epure-shell-rail epure-rail flex h-full min-h-0 w-rail shrink-0 flex-col"
    >
      {header ? <div className="epure-rail-header">{header}</div> : null}
      {sectionLabel ? (
        <>
          {header ? <div className="epure-rail-scope-divider" aria-hidden /> : null}
          <p className="epure-rail-section-label hidden min-w-0 truncate lg:block" title={sectionLabel}>
            {sectionLabel}
          </p>
        </>
      ) : null}
      <ul className="epure-rail-nav-list flex min-h-0 flex-1 flex-col overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  sidebarNavItemClass(
                    isActive,
                    cn(
                      "epure-nav-item w-full justify-center lg:justify-start",
                      (item.badgeCount != null || item.badgeLabel) && "lg:justify-between",
                    ),
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.1 : 1.75}
                      className={sidebarNavIconClass(isActive)}
                    />
                    <span className="hidden min-w-0 flex-1 truncate lg:inline">{item.label}</span>
                    {item.badgeLabel ? (
                      <span className="hidden rounded-sm border border-border-subtle bg-surface-2 px-1.5 py-0 font-mono text-[10px] font-medium uppercase leading-none tracking-wide text-fg-muted lg:inline-flex">
                        {item.badgeLabel}
                      </span>
                    ) : null}
                    {item.badgeCount != null ? (
                      <span className="hidden lg:inline-flex">
                        <NavCountPastille
                          count={item.badgeCount}
                          tone={item.badgeTone}
                          ariaLabel={item.badgeAriaLabel}
                        />
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
      {externalLinks && externalLinks.length > 0 ? (
        <ul className="epure-rail-nav-list epure-rail-nav-secondary flex flex-col">
          {externalLinks.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="epure-nav-item epure-nav-item--secondary flex items-center justify-center gap-2.5 font-normal tracking-ui focus-ring lg:justify-start"
                >
                  <Icon size={17} strokeWidth={1.75} className="epure-nav-item-icon shrink-0" />
                  <span className="hidden min-w-0 flex-1 truncate lg:inline">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
      <RailAccountFooter />
    </nav>
  );
}
