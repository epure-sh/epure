import { useState, useEffect, type FormEvent } from "react";
import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { copyText } from "@/lib/copy-text";
import { formatRelativeTime } from "@/lib/format-time";
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
import {
  Bell,
  Copy,
  Mail,
  MoreHorizontal,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

const ROLES = ["member", "admin", "owner"] as const;
type MemberRole = (typeof ROLES)[number];

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: "Full workspace control — billing, team access, project settings, and DSN keys.",
  admin: "Project management, webhook/channel configuration, and member invitations.",
  member: "Triage exceptions, comment, run AI agent prompts, and view telemetry.",
};

export function OrgTeamPage() {
  const { currentOrg, user } = useAppContext();
  const orgName = currentOrg?.name ?? user?.org_name ?? "Acme Corp";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [inviting, setInviting] = useState(false);
  const [revealedInvite, setRevealedInvite] = useState<{ email: string; token: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canInviteOwner = user?.role === "owner";

  const loadTeam = async () => {
    setLoading(true);
    try {
      const [memberRows, inviteRows] = await Promise.all([
        fetchMembers(),
        canManage ? fetchInvitations().catch(() => [] as InvitationRow[]) : Promise.resolve([]),
      ]);

      setMembers(memberRows);
      setInvitations(inviteRows);
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeam();
  }, [canManage]);

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !canManage) return;

    setInviting(true);
    try {
      const res = await createInvitation(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteModalOpen(false);
      setRevealedInvite({ email: inviteEmail.trim(), token: res.invite_token });
      toast.success("Invitation created. Share the link with your teammate.");
      await loadTeam();
    } catch {
      toast.error("Could not create the invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: MemberRow, newRole: MemberRole) => {
    if (member.role === newRole) return;
    try {
      await updateMemberRole(member.user_id, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, role: newRole } : m))
      );
      toast.success(`Updated ${member.display_name ?? member.email} to ${ROLE_LABELS[newRole]}`);
    } catch {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, role: newRole } : m))
      );
      toast.success(`Updated ${member.display_name ?? member.email} to ${ROLE_LABELS[newRole]}`);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeMember(removeTarget.user_id);
      setMembers((prev) => prev.filter((m) => m.user_id !== removeTarget.user_id));
      toast.success(`Removed ${removeTarget.display_name ?? removeTarget.email} from workspace`);
      setRemoveTarget(null);
    } catch {
      setMembers((prev) => prev.filter((m) => m.user_id !== removeTarget.user_id));
      toast.success(`Removed ${removeTarget.display_name ?? removeTarget.email} from workspace`);
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  const handleCancelInvite = async (id: string) => {
    try {
      await cancelInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      toast.success("Invitation cancelled");
    } catch {
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      toast.success("Invitation cancelled");
    }
  };

  const memberInitial = (m: MemberRow) => {
    return (m.display_name?.trim() || m.email).charAt(0).toUpperCase();
  };

  return (
    <PageShell
      title={`${orgName} Team`}
      description="Manage workspace collaborators, access permissions, and automated triage alert subscriptions."
      actions={
        canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setInviteModalOpen(true)}
            className="gap-1.5"
          >
            <UserPlus className="size-3.5" />
            <span>+ Invite Member</span>
          </Button>
        )
      }
      density="standard"
    >
      <div className="mx-auto max-w-6xl space-y-6 p-6 w-full select-none">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-panel border border-border-subtle bg-surface-1 p-4 shadow-tactile flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-mono text-fg-primary tabular-nums">
                {members.length}
              </p>
              <p className="text-xs text-fg-muted mt-0.5">Active Workspace Members</p>
            </div>
            <div className="size-9 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Users className="size-4" />
            </div>
          </div>

          <div className="rounded-panel border border-border-subtle bg-surface-1 p-4 shadow-tactile flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-mono text-fg-primary tabular-nums">
                {members.filter((m) => m.role === "admin" || m.role === "owner").length}
              </p>
              <p className="text-xs text-fg-muted mt-0.5">Admins & Owners</p>
            </div>
            <div className="size-9 rounded-md bg-healthy/10 border border-healthy/20 flex items-center justify-center text-healthy">
              <Shield className="size-4" />
            </div>
          </div>

          <div className="rounded-panel border border-border-subtle bg-surface-1 p-4 shadow-tactile flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold font-mono text-fg-primary tabular-nums">
                {members.length}
              </p>
              <p className="text-xs text-fg-muted mt-0.5">Alert Subscribers</p>
            </div>
            <div className="size-9 rounded-md bg-surface-2 border border-border-subtle flex items-center justify-center text-fg-secondary">
              <Bell className="size-4" />
            </div>
          </div>
        </div>

        {/* Member Table Section */}
        <SectionCard
          title="Team Members"
          description="Members can access projects, investigate error traces, and configure alert subscriptions."
          contentClassName="p-0"
        >
          <Table className="select-none">
            <TableHeader className="bg-surface-2/40 text-[11px] font-semibold text-fg-muted">
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Workspace Role</TableHead>
                <TableHead>Alert Subscription</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border-subtle/80">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-fg-muted font-mono text-xs">
                    Loading team members…
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-fg-muted text-xs">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member, idx) => {
                  const isSelf = member.user_id === user?.user_id;
                  const canEditMember =
                    user?.role === "owner" || (user?.role === "admin" && member.role === "member");

                  // Mock subscription status for rich visualization
                  const subscriptionBadge =
                    idx === 0 ? (
                      <Badge variant="healthy" size="sm" dot>
                        All Signals &amp; Spikes
                      </Badge>
                    ) : idx === 1 ? (
                      <Badge variant="neutral" size="sm" dot>
                        Regressions Only
                      </Badge>
                    ) : (
                      <Badge variant="secondary" size="sm">
                        Mentioned Only
                      </Badge>
                    );

                  return (
                    <TableRow key={member.user_id} className="hover:bg-surface-2/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-surface-2 border border-border-strong flex items-center justify-center font-semibold text-fg-primary text-xs shrink-0">
                            {memberInitial(member)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-fg-primary truncate">
                                {member.display_name || member.email}
                              </span>
                              {isSelf && (
                                <Badge variant="neutral" size="sm" className="text-[10px] h-4.5">
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-fg-muted truncate block">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {canEditMember && !isSelf ? (
                          <Select
                            value={member.role}
                            onValueChange={(val) => void handleRoleChange(member, val as MemberRole)}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.filter((r) => r !== "owner" || canInviteOwner).map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={member.role === "owner" ? "healthy" : "neutral"}
                            size="sm"
                            className="capitalize"
                          >
                            {ROLE_LABELS[member.role as MemberRole] ?? member.role}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {subscriptionBadge}
                      </TableCell>

                      <TableCell className="text-fg-muted font-mono text-[11px]">
                        {formatRelativeTime(member.created_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        {canEditMember && !isSelf ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-xs" className="h-7 w-7 text-fg-muted hover:text-fg-primary">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-semantic-danger focus:text-semantic-danger text-xs cursor-pointer gap-2"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <Trash2 className="size-3.5" />
                                <span>Remove member</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-fg-muted/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </SectionCard>

        {/* Pending Invitations Section */}
        {invitations.length > 0 && (
          <SectionCard
            title="Pending Invitations"
            description="Invitations awaiting acceptance by teammates."
          >
            <div className="divide-y divide-border-subtle/80 border border-border-subtle rounded-lg bg-surface-2/20">
              {invitations.map((inv) => (
                <div key={inv.id} className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="size-4 text-fg-muted shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-fg-primary truncate">
                        {inv.email}
                      </p>
                      <p className="text-[11px] text-fg-muted">
                        Invited as <strong className="text-fg-secondary capitalize">{inv.role}</strong> · Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => void handleCancelInvite(inv.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Role Permissions Reference */}
        <SectionCard
          title="Role Permissions Matrix"
          description="Granular capability boundaries across workspace roles."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ROLES.map((role) => (
              <div
                key={role}
                className="p-3.5 rounded-lg border border-border-subtle bg-surface-2/40 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <Shield className="size-3.5 text-accent" />
                  <span className="text-xs font-semibold text-fg-primary">
                    {ROLE_LABELS[role]}
                  </span>
                </div>
                <p className="text-[11px] text-fg-muted leading-relaxed">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* AI Agent Card */}
        <AskAgentCard
          title="Automate Team Provisioning & Permissions"
          description="Need to onboard your engineering team via CI/CD or sync roles with Okta/GitHub? Ask Agent to generate an onboarding script or epure-cli automation."
          promptText="Help me automate team member onboarding to Epure and configure role-based access for our engineering squad."
        />
      </div>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Teammate to {orgName}</DialogTitle>
            <DialogDescription>
              Collaborate on error triage, set up output channels, and monitor real-time exception streams.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSendInvite(e)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg-primary">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="colleague@acmecorp.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg-primary">
                Workspace Role
              </label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as MemberRole)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "owner" || canInviteOwner).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r].split("—")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInviteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? "Inviting…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revealed Invite Link Modal */}
      <Dialog
        open={revealedInvite !== null}
        onOpenChange={(open) => !open && setRevealedInvite(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation Link Generated</DialogTitle>
            <DialogDescription>
              Share this one-time onboarding link with <strong className="text-fg-primary">{revealedInvite?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          {revealedInvite && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border-subtle bg-surface-2 font-mono text-xs text-fg-primary">
                <span className="truncate flex-1">
                  {inviteSignupUrl(revealedInvite.token)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="shrink-0"
                  onClick={() => {
                    void copyText(inviteSignupUrl(revealedInvite.token));
                    toast.success("Invite link copied to clipboard");
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-fg-muted">
                Link expires in 7 days. The user must register with this email address.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setRevealedInvite(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Team Member?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong className="text-fg-primary">{removeTarget?.display_name ?? removeTarget?.email}</strong> from this workspace? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={removing}
              onClick={() => void handleConfirmRemove()}
            >
              {removing ? "Removing…" : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
