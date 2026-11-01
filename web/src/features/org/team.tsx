import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PageShell } from "@/ui/block";
import { EmptyState } from "@/components/kit/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  Copy,
  DotsThree,
  EnvelopeSimple,
  Icon,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UserPlus,
} from "@/components/ui/icon";
import { copyText } from "@/lib/copy-text";
import { formatRelativeTime } from "@/lib/format-time";
import { toastWithUndo } from "@/lib/toast-undo";
import { useAppContext } from "@/shell/app-context";
import {
  cancelInvitation,
  createInvitation,
  fetchInvitations,
  fetchMembers,
  inviteSignupUrl,
  removeMember,
  updateMemberRole,
  type InvitationRow,
  type MemberRow,
} from "@/lib/api";

const ROLES = ["member", "admin", "owner"] as const;
type MemberRole = (typeof ROLES)[number];

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_HINTS: Record<MemberRole, string> = {
  owner: "Billing, team, projects, and keys.",
  admin: "Projects, channels, and invites.",
  member: "Triage issues and view data.",
};

function isMemberRole(value: string): value is MemberRole {
  return ROLES.includes(value as MemberRole);
}

function memberName(member: MemberRow): string {
  return member.display_name?.trim() || member.email;
}

export function OrgTeamPage() {
  const { currentOrg, user } = useAppContext();
  const orgName = currentOrg?.name ?? user?.org_name ?? "Workspace";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [inviting, setInviting] = useState(false);
  const [revealedInvite, setRevealedInvite] = useState<{ email: string; token: string } | null>(
    null,
  );
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canInviteOwner = user?.role === "owner";

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const [memberRows, inviteRows] = await Promise.all([
        fetchMembers().catch(() => {
          if (!user) return [] as MemberRow[];
          return [
            {
              user_id: user.user_id,
              email: user.email,
              display_name: user.display_name,
              role: user.role,
              created_at: new Date().toISOString(),
            },
          ] as MemberRow[];
        }),
        canManage ? fetchInvitations().catch(() => [] as InvitationRow[]) : Promise.resolve([]),
      ]);
      setMembers(memberRows);
      setInvitations(inviteRows);
    } catch {
      toast.error("Could not load team");
    } finally {
      setLoading(false);
    }
  }, [canManage, user]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const haystack = `${member.display_name ?? ""} ${member.email} ${member.role}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, query]);

  const filteredInvites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invitations;
    return invitations.filter((invite) => {
      const haystack = `${invite.email} ${invite.role}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [invitations, query]);

  async function handleSendInvite(event: FormEvent) {
    event.preventDefault();
    if (!inviteEmail.trim() || !canManage) return;
    setInviting(true);
    try {
      const email = inviteEmail.trim();
      const res = await createInvitation(email, inviteRole);
      setInviteEmail("");
      setInviteOpen(false);
      setRevealedInvite({ email, token: res.invite_token });
      toast.success("Invitation created. Share the link");
      await loadTeam();
    } catch {
      toast.error("Could not create invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: MemberRow, nextRole: MemberRole) {
    if (member.role === nextRole) return;
    const previous = member.role;
    setRoleBusyId(member.user_id);
    try {
      await updateMemberRole(member.user_id, nextRole);
      setMembers((current) =>
        current.map((row) =>
          row.user_id === member.user_id ? { ...row, role: nextRole } : row,
        ),
      );
      toastWithUndo(`Updated ${memberName(member)} to ${ROLE_LABELS[nextRole]}`, async () => {
        await updateMemberRole(member.user_id, previous as MemberRole);
        setMembers((current) =>
          current.map((row) =>
            row.user_id === member.user_id ? { ...row, role: previous } : row,
          ),
        );
      });
    } catch {
      toast.error("Could not update role");
    } finally {
      setRoleBusyId(null);
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeMember(removeTarget.user_id);
      setMembers((current) => current.filter((row) => row.user_id !== removeTarget.user_id));
      toast(`Removed ${memberName(removeTarget)}`, {
        description: "Re-invite to restore access",
      });
      setRemoveTarget(null);
    } catch {
      toast.error("Could not remove member");
    } finally {
      setRemoving(false);
    }
  }

  async function handleCancelInvite(id: string) {
    const invite = invitations.find((row) => row.id === id);
    try {
      await cancelInvitation(id);
      setInvitations((current) => current.filter((row) => row.id !== id));
      if (invite) {
        toastWithUndo("Invitation cancelled", async () => {
          const res = await createInvitation(invite.email, invite.role as MemberRole);
          await loadTeam();
          if (res.invite_token) {
            setRevealedInvite({ email: invite.email, token: res.invite_token });
          }
        });
      } else {
        toast.success("Invitation cancelled");
      }
    } catch {
      toast.error("Could not cancel invitation");
    }
  }

  return (
    <PageShell density="standard">
      <Box flexDirection="column" gap="l" width="100%" padding="l">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Text as="h2" variant="heading-xs">
              Team
            </Text>
            {!loading ? (
              <Badge variant="neutral" size="compact">
                {members.length}
                {invitations.length > 0 ? ` · ${invitations.length} pending` : ""}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {members.length + invitations.length >= 4 ? (
              <div className="w-56">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search people…"
                  leadingIcon={<Icon icon={MagnifyingGlass} size={14} />}
                />
              </div>
            ) : null}
            {canManage ? (
              <Button type="button" variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                <Icon icon={UserPlus} size={14} />
                Invite
              </Button>
            ) : null}
          </div>
        </div>

        <p className="max-w-2xl text-xs text-fg-muted">
          People in <span className="font-medium text-fg-primary">{orgName}</span>. Roles control
          projects, client keys, and output channels.
        </p>

        <div className="w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
            <p className="text-xs font-medium text-fg-primary">Members</p>
            <p className="text-2xs text-fg-muted">
              {loading
                ? "Loading…"
                : `${filteredMembers.length} people${
                    filteredInvites.length > 0 ? ` · ${filteredInvites.length} invited` : ""
                  }`}
            </p>
          </div>

          {loading ? (
            <div className="space-y-0 divide-y divide-border-subtle">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="size-9 animate-pulse rounded-full bg-surface-2" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
                    <div className="h-2.5 w-56 animate-pulse rounded bg-surface-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 && filteredInvites.length === 0 ? (
            query.trim() ? (
              <EmptyState
                layout="inset"
                tone="search"
                icon={MagnifyingGlass}
                title="No one matches that search"
                description="Try another name or email, or clear search to see everyone again."
                actionLabel="Clear search"
                onAction={() => setQuery("")}
              />
            ) : (
              <EmptyState
                layout="inset"
                tone="first-run"
                icon={UserPlus}
                title="Just you for now"
                description="Invite a teammate when you're ready to triage together. Roles stay simple: member, admin, or owner."
                hint="You can change roles or withdraw invites anytime."
                actionLabel={canManage ? "Invite teammate" : undefined}
                onAction={canManage ? () => setInviteOpen(true) : undefined}
              />
            )
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filteredMembers.map((member) => {
                const isSelf = member.user_id === user?.user_id;
                const role = isMemberRole(member.role) ? member.role : "member";
                const canEditMember =
                  canManage &&
                  !isSelf &&
                  (user?.role === "owner" || (user?.role === "admin" && role === "member"));

                return (
                  <li
                    key={member.user_id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={memberName(member)} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate text-xs font-medium text-fg-primary">
                            {memberName(member)}
                          </p>
                          {isSelf ? (
                            <Badge variant="neutral" size="compact">
                              You
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate font-mono text-2xs text-fg-muted">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                      {canEditMember ? (
                        <Select
                          value={role}
                          disabled={roleBusyId === member.user_id}
                          onValueChange={(value) =>
                            void handleRoleChange(member, value as MemberRole)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Role for ${memberName(member)}`}
                            className="h-7 w-[7.5rem] text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.filter((option) => option !== "owner" || canInviteOwner).map(
                              (option) => (
                                <SelectItem key={option} value={option}>
                                  {ROLE_LABELS[option]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant={role === "owner" ? "healthy" : "neutral"}
                          size="compact"
                        >
                          {ROLE_LABELS[role]}
                        </Badge>
                      )}

                      <span className="hidden w-16 text-right text-2xs text-fg-muted sm:inline">
                        {formatRelativeTime(member.created_at)}
                      </span>

                      {canEditMember ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-7"
                              aria-label={`Actions for ${memberName(member)}`}
                            >
                              <Icon icon={DotsThree} size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                void handleRoleChange(
                                  member,
                                  role === "admin" ? "member" : "admin",
                                )
                              }
                            >
                              <Icon icon={PencilSimple} size={14} />
                              {role === "admin" ? "Make member" : "Make admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger"
                              onClick={() => setRemoveTarget(member)}
                            >
                              <Icon icon={Trash} size={14} />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="inline-block size-7" aria-hidden />
                      )}
                    </div>
                  </li>
                );
              })}

              {filteredInvites.map((invite) => {
                const role = isMemberRole(invite.role) ? invite.role : "member";
                return (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 bg-surface-2/40 px-4 py-3 sm:flex-nowrap"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border-subtle text-fg-muted">
                        <Icon icon={EnvelopeSimple} size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate font-mono text-xs font-medium text-fg-primary">
                            {invite.email}
                          </p>
                          <Badge variant="neutral" size="compact">
                            Pending
                          </Badge>
                        </div>
                        <p className="text-2xs text-fg-muted">
                          {ROLE_LABELS[role]} · expires{" "}
                          {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-2xs"
                          onClick={() => void handleCancelInvite(invite.id)}
                        >
                          Withdraw
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <div
              key={role}
              className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2.5"
            >
              <p className="text-xs font-medium text-fg-primary">{ROLE_LABELS[role]}</p>
              <p className="mt-0.5 text-2xs text-fg-muted">{ROLE_HINTS[role]}</p>
            </div>
          ))}
        </div>
      </Box>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to {orgName}</DialogTitle>
            <DialogDescription>
              They get a one-time link. It works for 7 days with this email.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleSendInvite(event)}>
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-xs font-medium text-fg-primary">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@company.com"
                required
                autoFocus
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg-primary">Role</label>
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as MemberRole)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((role) => role !== "owner" || canInviteOwner).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}: {ROLE_HINTS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedInvite !== null}
        onOpenChange={(open) => {
          if (!open) setRevealedInvite(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share invite link</DialogTitle>
            <DialogDescription>
              Send this link to{" "}
              <span className="font-medium text-fg-primary">{revealedInvite?.email}</span>.
            </DialogDescription>
          </DialogHeader>
          {revealedInvite ? (
            <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-2.5 py-2">
              <p className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-primary">
                {inviteSignupUrl(revealedInvite.token)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 shrink-0"
                aria-label="Copy invite link"
                onClick={() => {
                  void copyText(inviteSignupUrl(revealedInvite.token)).then((ok) => {
                    toast[ok ? "success" : "error"](ok ? "Link copied" : "Could not copy");
                  });
                }}
              >
                <Icon icon={Copy} size={14} />
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="primary" size="sm" onClick={() => setRevealedInvite(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-fg-primary">
                {removeTarget ? memberName(removeTarget) : ""}
              </span>{" "}
              loses access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={removing}
              onClick={() => void handleConfirmRemove()}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
