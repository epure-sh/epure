import {
  Building2,
  Check,
  CreditCard,
  KeyRound,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { acceptInvitation } from "../../lib/api";
import { cn } from "../../lib/cn";
import { workspacePath, workspaceSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Empty } from "../../ui/empty";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { useToast } from "../../ui/toast-provider";

export function extractInviteToken(tokenOrUrl: string): string {
  const trimmed = tokenOrUrl.trim();
  if (!trimmed) return "";

  // 1. Try URL parsing
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(trimmed, origin);
    const queryToken =
      url.searchParams.get("token") ??
      url.searchParams.get("invite") ??
      url.searchParams.get("invite_token") ??
      url.searchParams.get("invitation_token") ??
      url.searchParams.get("t");
    if (queryToken) return queryToken.trim();

    // Check pathname segments: e.g. /accept-invitation/TOKEN or /invite/TOKEN or /join/TOKEN
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const last = segments[segments.length - 1];
      const prev = segments[segments.length - 2]?.toLowerCase();
      if (
        prev === "invite" ||
        prev === "invitation" ||
        prev === "accept-invitation" ||
        prev === "join"
      ) {
        return last;
      }
    }
  } catch {
    // not a valid URL
  }

  // 2. Regex for standard UUID (8-4-4-4-12)
  const uuidMatch = trimmed.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  );
  if (uuidMatch) {
    return uuidMatch[0];
  }

  // 3. Fallback to raw trimmed string
  return trimmed;
}

export function OrganisationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    organizations,
    currentOrg,
    switchOrg,
    refreshOrganizations,
    userLoading,
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const safeOrganizations = useMemo(
    () => (Array.isArray(organizations) ? organizations : []),
    [organizations],
  );

  const filteredOrgs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return safeOrganizations;
    return safeOrganizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.role.toLowerCase().includes(q) ||
        (org.plan_tier && org.plan_tier.toLowerCase().includes(q)),
    );
  }, [safeOrganizations, searchQuery]);

  const stats = useMemo(() => {
    let ownerCount = 0;
    let adminCount = 0;
    let memberCount = 0;
    for (const org of safeOrganizations) {
      if (org.role === "owner") ownerCount++;
      else if (org.role === "admin") adminCount++;
      else memberCount++;
    }
    return {
      total: safeOrganizations.length,
      ownerCount,
      adminCount,
      memberCount,
    };
  }, [safeOrganizations]);

  async function handleSwitch(orgId: string, redirectTo?: string) {
    if (switchingId) return;
    setSwitchingId(orgId);
    try {
      await switchOrg(orgId);
      const target = safeOrganizations.find((o) => o.id === orgId);
      toast(`Switched to ${target?.name ?? "organisation"}`);
      if (redirectTo) {
        navigate(redirectTo);
      }
    } catch {
      toast("Failed to switch organisation");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshOrganizations();
      toast("Organisations refreshed");
    } catch {
      toast("Could not refresh organisations");
    } finally {
      setRefreshing(false);
    }
  }

  function handleCardClick(orgId: string, isCurrent: boolean) {
    if (isCurrent) {
      navigate(workspacePath());
    } else {
      void handleSwitch(orgId, workspacePath());
    }
  }

  async function handleJoinSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const extracted = extractInviteToken(inviteToken);
    if (!extracted) {
      setJoinError("Please provide an invite token or link");
      return;
    }
    setJoinBusy(true);
    setJoinError(null);

    try {
      await acceptInvitation(extracted);
      toast("Successfully joined organisation!");
      setJoinModalOpen(false);
      setInviteToken("");
      await refreshOrganizations();
    } catch {
      setJoinError("Invalid or expired invitation token. Please request a new invite.");
    } finally {
      setJoinBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter organisations by name, role, or tier…"
              className="h-8 pl-8 pr-8 text-xs bg-surface-1/70"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary h-6 w-6"
                aria-label="Clear filter"
              >
                <X size={13} />
              </Button>
            )}

          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2 text-2xs text-fg-muted">
              <Badge variant="neutral" size="sm" className="gap-1.5 font-medium text-fg-primary">
                <Building2 size={12} className="text-primary" />
                <span>{stats.total} total</span>
              </Badge>
              {stats.ownerCount > 0 ? (
                <Badge variant="neutral" size="sm" className="text-fg-secondary">
                  Owner in {stats.ownerCount}
                </Badge>
              ) : null}
              {stats.adminCount > 0 ? (
                <Badge variant="neutral" size="sm" className="text-fg-secondary">
                  Admin in {stats.adminCount}
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Refresh organisations list"
            >
              <RefreshCw size={13} className={cn("text-fg-muted", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setJoinError(null);
                setJoinModalOpen(true);
              }}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <KeyRound size={13} />
              <span>Join via Invite</span>
            </Button>
          </div>
        </div>

        {/* Loading skeleton */}
        {userLoading && safeOrganizations.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </div>
        ) : filteredOrgs.length === 0 ? (
          <Empty
            variant={searchQuery ? "search" : "default"}
            title={searchQuery ? "No matching organisations" : "No organisations found"}
            description={
              searchQuery
                ? `No organizations matched your search "${searchQuery}". Clear your search query to see all workspaces.`
                : "You don't belong to any organizations yet. Use an invite token to join a workspace."
            }
            action={
              searchQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setJoinModalOpen(true)}
                >
                  Join via Invite
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrgs.map((org) => {
              const isActive = org.is_current || org.id === currentOrg?.id;
              const isOwner = org.role === "owner";
              const isAdmin = org.role === "admin";
              const canManage = isOwner || isAdmin;
              const isBusy = switchingId === org.id;

              return (
                <Card
                  key={org.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardClick(org.id, isActive)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(org.id, isActive);
                    }
                  }}
                  className={cn(
                    "flex flex-col justify-between transition-all duration-150 relative cursor-pointer focus-ring group",
                    isActive
                      ? "border-primary/50 bg-surface-1 shadow-sm ring-1 ring-primary/25"
                      : "hover:border-border-strong hover:bg-surface-1/90 hover:shadow-xs",
                    isBusy && "opacity-80 cursor-wait",
                  )}
                >
                  <div>
                    <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2 border-b-0 bg-transparent">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span
                          className={cn(
                            "mt-1.5 size-2 rounded-full shrink-0",
                            isActive
                              ? "bg-healthy ring-2 ring-healthy/30 animate-pulse"
                              : "bg-fg-muted/40",
                          )}
                          title={isActive ? "Active workspace" : "Joined organisation"}
                        />
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-semibold tracking-tight text-fg-primary break-words leading-snug group-hover:text-primary transition-colors">
                            {org.name}
                          </h2>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={isOwner ? "env" : isAdmin ? "neutral" : "secondary"}
                              size="compact"
                              className="capitalize text-[10px] font-mono tracking-ui"
                            >
                              {org.role}
                            </Badge>
                            {org.plan_tier && (
                              <Badge
                                variant="neutral"
                                size="compact"
                                className="capitalize text-[10px] font-mono tracking-ui"
                              >
                                {org.plan_tier}
                              </Badge>
                            )}
                            {isActive && (
                              <Badge
                                variant="healthy"
                                size="compact"
                                className="text-[10px] gap-1 font-medium"
                              >
                                <Check size={10} />
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 text-xs text-fg-secondary space-y-2">
                      <div className="flex items-center gap-1.5 text-2xs text-fg-muted">
                        <Users size={12} className="shrink-0" />
                        <span>
                          {org.member_count} member{org.member_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-2xs text-fg-muted font-mono truncate">
                        ID: {org.id}
                      </p>
                    </CardContent>
                  </div>

                  {/* Actions Area — Strict User Rights Enforcement */}
                  <CardFooter
                    className="p-3 bg-surface-2/30 border-t border-border-subtle flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isActive ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(workspacePath());
                          }}
                          className="h-7 text-xs font-medium gap-1.5 flex-1"
                        >
                          <Layers size={13} />
                          <span>Projects</span>
                        </Button>

                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs px-2 gap-1"
                                title="Organisation Management"
                              >
                                <Settings size={13} />
                                <span className="hidden sm:inline">Manage</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-lg border border-border-subtle bg-surface-1">
                              <DropdownMenuLabel className="text-2xs uppercase tracking-wider text-fg-muted">
                                Manage Organisation
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onSelect={() => navigate(workspaceSettingsPath())}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Settings size={13} className="text-fg-muted" />
                                <span>Org Settings</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => navigate("/team")}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Users size={13} className="text-fg-muted" />
                                <span>Team Members</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => navigate("/org/channels")}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Radio size={13} className="text-fg-muted" />
                                <span>Output Channels</span>
                              </DropdownMenuItem>
                              {isOwner && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => navigate("/billing")}
                                    className="text-xs cursor-pointer gap-2"
                                  >
                                    <CreditCard size={13} className="text-fg-muted" />
                                    <span>Usage & Billing</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span
                            className="text-2xs text-fg-muted px-2 italic"
                            title="Member role has view-only workspace access"
                          >
                            Member view
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isBusy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSwitch(org.id);
                          }}
                          className="h-7 text-xs font-medium gap-1.5 flex-1"
                        >
                          {isBusy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Building2 size={13} />
                          )}
                          <span>{isBusy ? "Switching…" : "Switch to Org"}</span>
                        </Button>

                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isBusy}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 text-xs px-2 gap-1 text-fg-muted hover:text-fg-primary"
                                title="Switch to this organisation and open management view"
                              >
                                <Settings size={13} />
                                <span className="hidden sm:inline">Manage</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-lg border border-border-subtle bg-surface-1">
                              <DropdownMenuLabel className="text-2xs uppercase tracking-wider text-fg-muted">
                                Manage Organisation
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onSelect={() => void handleSwitch(org.id, workspaceSettingsPath())}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Settings size={13} className="text-fg-muted" />
                                <span>Org Settings</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void handleSwitch(org.id, "/team")}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Users size={13} className="text-fg-muted" />
                                <span>Team Members</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void handleSwitch(org.id, "/org/channels")}
                                className="text-xs cursor-pointer gap-2"
                              >
                                <Radio size={13} className="text-fg-muted" />
                                <span>Output Channels</span>
                              </DropdownMenuItem>
                              {isOwner && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => void handleSwitch(org.id, "/billing")}
                                    className="text-xs cursor-pointer gap-2"
                                  >
                                    <CreditCard size={13} className="text-fg-muted" />
                                    <span>Usage & Billing</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span
                            className="text-2xs text-fg-muted px-1 italic"
                            title="Member role has view-only workspace access"
                          >
                            Member view
                          </span>
                        )}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Join via Invite Dialog */}
      <Dialog open={joinModalOpen} onOpenChange={setJoinModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              <span>Join an Organisation</span>
            </DialogTitle>
            <DialogDescription>
              Enter an invitation token or paste your invite link to join an existing team workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleJoinSubmit(e)} className="space-y-4 pt-2">
            <Field
              label="Invitation Token or Link"
              htmlFor="invite-token-input"
              error={joinError ?? undefined}
            >
              <Input
                id="invite-token-input"
                type="text"
                value={inviteToken}
                onChange={(e) => {
                  setInviteToken(e.target.value);
                  setJoinError(null);
                }}
                placeholder="Paste token or https://…/accept-invitation?token=…"
                autoFocus
                disabled={joinBusy}
                className="h-9 font-mono text-xs"
              />
            </Field>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setJoinModalOpen(false)}
                disabled={joinBusy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={joinBusy || !inviteToken.trim()}
                className="gap-1.5"
              >
                {joinBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{joinBusy ? "Joining…" : "Join Organisation"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
