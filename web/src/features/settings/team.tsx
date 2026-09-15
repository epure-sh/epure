import { Mail, MoreHorizontal, Shield, UserMinus, UserPlus } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
} from "../../lib/api";
import { formatRelativeTime } from "../../lib/format-time";
import { useAppContext } from "../../shell/app-context";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Empty } from "../../ui/empty";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { SectionHeader } from "../../ui/section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { CopyButton } from "../../ui/copy-button";
import { CardRowSkeleton } from "../../ui/skeleton";
import { useToast } from "../../ui/toast-provider";
import { InfoCallout } from "./shared";

const roles = ["member", "admin", "owner"] as const;
type MemberRole = (typeof roles)[number];

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: "Full workspace control — billing, team, projects, and settings.",
  admin: "Manage projects, DSN keys, webhooks, and invite members.",
  member: "View issues, triage, and comment — no workspace administration.",
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function roleBadgeVariant(role: string): "default" | "env" | "secondary" {
  if (role === "owner") {
    return "default";
  }
  if (role === "admin") {
    return "env";
  }
  return "secondary";
}

function memberLabel(member: MemberRow): string {
  return member.display_name?.trim() || member.email.split("@")[0] || member.email;
}

function memberInitial(member: MemberRow): string {
  return memberLabel(member).charAt(0).toUpperCase();
}

function canManageMember(
  actorRole: string | undefined,
  targetRole: string,
  isSelf: boolean,
): boolean {
  if (isSelf || !actorRole) {
    return false;
  }
  if (actorRole === "owner") {
    return true;
  }
  if (actorRole === "admin") {
    return targetRole === "member";
  }
  return false;
}

function assignableRoles(actorRole: string | undefined, targetRole: string): MemberRole[] {
  if (!canManageMember(actorRole, targetRole, false)) {
    return [];
  }
  if (actorRole === "owner") {
    return [...roles];
  }
  return ["member", "admin"];
}

export function TeamSettings() {
  const { user } = useAppContext();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [revealedInvite, setRevealedInvite] = useState<{
    email: string;
    inviteToken: string;
  } | null>(null);
  const { toast } = useToast();

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canInviteOwner = user?.role === "owner";

  const stats = useMemo(() => {
    const adminCount = members.filter(
      (member) => member.role === "admin" || member.role === "owner",
    ).length;
    return {
      members: members.length,
      pending: invitations.length,
      admins: adminCount,
    };
  }, [members, invitations]);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const memberRows = await fetchMembers();
      setMembers(memberRows);
      if (canManage) {
        const inviteRows = await fetchInvitations();
        setInvitations(inviteRows);
      } else {
        setInvitations([]);
      }
    } catch {
      toast("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [canManage, toast]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    if (inviteRole === "owner" && !canInviteOwner) {
      return;
    }

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError(null);
    setBusy(true);
    try {
      const response = await createInvitation(trimmed, inviteRole);
      setEmail("");
      setRevealedInvite({
        email: trimmed,
        inviteToken: response.invite_token,
      });
      toast("Invitation created — share the invite link");
      await loadTeam();
    } catch {
      toast("Failed to send invitation");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelInvitation(id: string) {
    setBusy(true);
    try {
      await cancelInvitation(id);
      await loadTeam();
      toast("Invitation cancelled");
    } catch {
      toast("Failed to cancel invitation");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendInvitation(invitation: InvitationRow) {
    setBusy(true);
    try {
      await cancelInvitation(invitation.id);
      const response = await createInvitation(
        invitation.email,
        invitation.role as MemberRole,
      );
      setRevealedInvite({
        email: invitation.email,
        inviteToken: response.invite_token,
      });
      toast("Invitation resent — share the new invite link");
      await loadTeam();
    } catch {
      toast("Failed to resend invitation");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(member: MemberRow, role: MemberRole) {
    if (role === member.role) {
      return;
    }
    setBusy(true);
    try {
      await updateMemberRole(member.user_id, role);
      await loadTeam();
      toast(`Updated ${memberLabel(member)} to ${ROLE_LABELS[role]}`);
    } catch {
      toast("Failed to update role");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) {
      return;
    }
    setBusy(true);
    try {
      await removeMember(removeTarget.user_id);
      toast(`Removed ${memberLabel(removeTarget)} from the team`);
      setRemoveTarget(null);
      await loadTeam();
    } catch {
      toast("Failed to remove member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums text-ink">{stats.members}</p>
            <p className="mt-1 text-sm text-ink-muted">Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums text-ink">{stats.admins}</p>
            <p className="mt-1 text-sm text-ink-muted">Admins & owners</p>
          </CardContent>
        </Card>
        {canManage ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold tabular-nums text-ink">{stats.pending}</p>
              <p className="mt-1 text-sm text-ink-muted">Pending invites</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <section>
        <SectionHeader
          title="Members"
          description={`${stats.members} people in this workspace`}
        />
        {loading ? (
          <ul className="mt-3 space-y-2">
            <CardRowSkeleton />
            <CardRowSkeleton />
          </ul>
        ) : members.length === 0 ? (
          <Empty
            className="mt-3"
            title="No members yet"
            description="Invite teammates to collaborate on error triage."
          />
        ) : (
          <Card className="mt-3 overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {members.map((member) => {
                const isSelf = member.user_id === user?.user_id;
                const manageable = canManageMember(user?.role, member.role, isSelf);
                const roleOptions = assignableRoles(user?.role, member.role);

                return (
                  <li
                    key={member.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg-subtle text-sm font-medium text-ink"
                        aria-hidden
                      >
                        {memberInitial(member)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">
                            {memberLabel(member)}
                          </p>
                          {isSelf ? (
                            <Badge variant="env" size="compact">You</Badge>
                          ) : null}
                        </div>
                        <p className="truncate font-mono text-xs text-ink-muted">{member.email}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Joined {formatRelativeTime(member.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {manageable && roleOptions.length > 0 ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            void handleRoleChange(member, value as MemberRole)
                          }
                          disabled={busy}
                        >
                          <SelectTrigger
                            aria-label={`Role for ${memberLabel(member)}`}
                            className="h-8 w-[7.5rem]"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {ROLE_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={roleBadgeVariant(member.role)} className="capitalize">
                          {ROLE_LABELS[member.role as MemberRole] ?? member.role}
                        </Badge>
                      )}

                      {manageable ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${memberLabel(member)}`}
                              disabled={busy}
                            >
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-semantic-danger focus:text-semantic-danger"
                              onClick={() => setRemoveTarget(member)}
                            >
                              <UserMinus size={14} className="mr-2" />
                              Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      {canManage ? (
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus size={16} className="text-ink-muted" />
                Invite teammate
              </CardTitle>
              <CardDescription>
                They register or sign in with Google using the invited email address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => void handleInvite(event)}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field
                    label="Email"
                    htmlFor="invite-email"
                    className="min-w-0 flex-1"
                    error={emailError ?? undefined}
                  >
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@company.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (emailError) {
                          setEmailError(null);
                        }
                      }}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Role" htmlFor="invite-role">
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as MemberRole)}
                    >
                      <SelectTrigger id="invite-role" className="w-[8rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles
                          .filter((option) => option !== "owner" || canInviteOwner)
                          .map((option) => (
                            <SelectItem key={option} value={option}>
                              {ROLE_LABELS[option]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button type="submit" disabled={busy || !email.trim()}>
                    Send invite
                  </Button>
                </div>
                <p className="text-xs text-ink-muted">{ROLE_DESCRIPTIONS[inviteRole]}</p>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : (
        <InfoCallout>
          You have member access. Ask an admin or owner to invite new teammates.
        </InfoCallout>
      )}

      {canManage ? (
        <section>
          <SectionHeader
            title="Pending invitations"
            description={
              invitations.length > 0
                ? `${invitations.length} awaiting acceptance`
                : "No outstanding invites"
            }
          />
          {loading ? (
            <ul className="mt-3">
              <CardRowSkeleton />
            </ul>
          ) : invitations.length === 0 ? (
            <Empty
              className="mt-3"
              variant="inset"
              title="No pending invitations"
              description="Invites appear here until the recipient signs up or signs in."
            />
          ) : (
            <Card className="mt-3 overflow-hidden p-0">
              <ul className="divide-y divide-border">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-bg-subtle text-ink-muted"
                        aria-hidden
                      >
                        <Mail size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm text-ink">{invitation.email}</p>
                        <p className="text-xs text-ink-muted">
                          <Badge
                            variant={roleBadgeVariant(invitation.role)}
                            className="mr-2 capitalize"
                          >
                            {ROLE_LABELS[invitation.role as MemberRole] ?? invitation.role}
                          </Badge>
                          Sent {formatRelativeTime(invitation.created_at)} · expires{" "}
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleResendInvitation(invitation)}
                      >
                        Resend
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleCancelInvitation(invitation.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={16} className="text-ink-muted" />
              Roles & permissions
            </CardTitle>
            <CardDescription>What each role can do in this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roles.map((role) => (
              <div key={role} className="flex gap-3">
                <Badge variant={roleBadgeVariant(role)} className="mt-0.5 shrink-0 capitalize">
                  {ROLE_LABELS[role]}
                </Badge>
                <p className="text-sm text-ink-muted">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `${memberLabel(removeTarget)} (${removeTarget.email}) will lose access to this workspace immediately.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoveTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void handleRemoveMember()}>
              Remove member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedInvite !== null}
        onOpenChange={(open) => !open && setRevealedInvite(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share invite link</DialogTitle>
            <DialogDescription>
              {revealedInvite
                ? `Send this link to ${revealedInvite.email}. They must register or sign in with Google using that email address.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {revealedInvite ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-xs text-ink">
                  {inviteSignupUrl(revealedInvite.inviteToken)}
                </code>
                <CopyButton
                  value={inviteSignupUrl(revealedInvite.inviteToken)}
                  label="Copy link"
                  onCopied={() => toast("Invite link copied")}
                />
              </div>
              <p className="text-xs text-ink-muted">
                The link expires in 7 days. Resend to issue a fresh link.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setRevealedInvite(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
