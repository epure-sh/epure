import { Key, Laptop, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { cn } from "../../lib/cn";
import { userSettingsPath } from "../../lib/paths";
import { RouteErrorBoundary } from "../../ui/route-error-boundary";
import { AgentTokensTab } from "../org/account/agent-tokens-tab";
import { ConnectedAppsTab } from "../org/account/connected-apps-tab";
import { GeneralTab } from "../org/account/general-tab";
import { SecurityTab } from "../org/account/security-tab";
import { useAccountSettings } from "../org/account/use-account-settings";

const userTabs = [
  {
    id: "general",
    label: "Profile",
    description: "Display name & email address",
    icon: SlidersHorizontal,
    path: userSettingsPath(),
  },
  {
    id: "security",
    label: "Security & Credentials",
    description: "Password, two-factor & sessions",
    icon: ShieldCheck,
    path: userSettingsPath("security"),
  },
  {
    id: "agent",
    label: "Personal Access Tokens",
    description: "CLI & personal agent API keys",
    icon: Key,
    path: userSettingsPath("agent"),
  },
  {
    id: "connected-apps",
    label: "Connected Apps & CLI",
    description: "OAuth CLI & MCP sessions",
    icon: Laptop,
    path: userSettingsPath("connected-apps"),
  },
] as const;

export function UserSettingsPage() {
  const settings = useAccountSettings();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* User Settings Nav */}
        <nav
          aria-label="User settings"
          className="epure-settings-nav flex w-full md:w-60 shrink-0 flex-col border-b md:border-b-0 md:border-r border-border-subtle bg-surface-1/30 p-2.5 select-none"
        >
          <div className="space-y-1">
            <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              Personal Account
            </h3>
            <div className="space-y-0.5">
              {userTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    end={tab.id === "general"}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-start gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors focus-ring",
                        isActive
                          ? "bg-state-selected text-fg-primary font-semibold border-l-2 border-primary"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg-primary border-l-2 border-transparent",
                      )
                    }
                  >
                    <Icon
                      size={15}
                      className="mt-0.5 shrink-0 stroke-[1.8] text-fg-muted group-hover:text-fg-primary"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-fg-primary leading-tight">
                        {tab.label}
                      </span>
                      <span className="text-2xs text-fg-muted leading-tight mt-0.5">
                        {tab.description}
                      </span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Content Tab View */}
        <div className="min-w-0 flex-1 overflow-auto bg-canvas p-4 md:p-6">
          <div className="mx-auto max-w-default space-y-4">
            <RouteErrorBoundary title="User Settings error" backHref="/user/settings">
              <Routes>
                <Route index element={<GeneralTab settings={settings} />} />
                <Route path="security" element={<SecurityTab settings={settings} />} />
                <Route path="agent" element={<AgentTokensTab />} />
                <Route path="connected-apps" element={<ConnectedAppsTab />} />
                <Route path="*" element={<Navigate to={userSettingsPath()} replace />} />
              </Routes>
            </RouteErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
