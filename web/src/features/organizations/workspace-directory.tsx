import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PolarCard } from "@/components/kit/polar-card";
import { toast } from "@/components/ui/sonner";
import { PageShell } from "@/ui/block";
import { apiErrorStatus, createWorkspace, updateWorkspace, type UserOrganization } from "@/lib/api";
import { billingPath, organizationsPath, userSettingsPath, workspacePath } from "@/lib/paths";
import { useAppContext } from "@/shell/app-context";

type WorkspaceAction =
  | { kind: "create"; billingWorkspace: UserOrganization }
  | { kind: "rename" | "delete"; workspace: UserOrganization };

function WorkspaceDialog({ action, onClose }: { action: WorkspaceAction; onClose: () => void }) {
  const { refreshUser, refreshOrganizations } = useAppContext();
  const workspace = action.kind === "create" ? null : action.workspace;
  const deleting = action.kind === "delete";
  const [name, setName] = useState(action.kind === "rename" ? action.workspace.name : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = action.kind === "create" ? "Create workspace" : deleting ? "Delete workspace" : "Rename workspace";
  const nameLength = Array.from(name.trim()).length;
  const valid = deleting ? name === workspace?.name : nameLength > 0 && nameLength <= 64;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      if (workspace) {
        await updateWorkspace(workspace.id, name, deleting ? "DELETE" : "PATCH");
      } else if (action.kind === "create") {
        await createWorkspace(name, action.billingWorkspace.id);
      }
    } catch (failure) {
      const status = apiErrorStatus(failure);
      setError(status === 400
        ? "Enter a workspace name of up to 64 characters."
        : deleting && status === 409
        ? "Switch to another workspace first. A workspace can be deleted here once it has no projects, other members, or billing history."
        : status === 403
          ? "Your workspace permissions or Scale access changed. Refresh and try again."
          : "Could not save the workspace. Try again.");
      setBusy(false);
      return;
    }
    if (action.kind === "rename") {
      await refreshUser().catch(refreshOrganizations);
    } else {
      await refreshOrganizations();
    }
    toast.success(deleting ? "Workspace deleted" : workspace ? "Workspace renamed" : "Workspace created");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {deleting
              ? "This permanently removes the empty workspace and its configuration. Type its name to confirm."
              : action.kind === "create"
                ? "This workspace will share the Scale plan and event quota from " + action.billingWorkspace.name + "."
                : "The new name is visible to everyone in this workspace."}
          </DialogDescription>
        </DialogHeader>
        <Box as="form" flexDirection="column" gap="m" onSubmit={(event) => void submit(event)}>
          <Input aria-label="Workspace name" value={name} maxLength={deleting ? workspace?.name.length : 128} autoComplete="off"
            disabled={busy} onChange={(event) => setName(event.target.value)} />
          {!deleting && nameLength > 64 ? <Text variant="caption">Use 64 characters or fewer.</Text> : null}
          {error ? <Text role="alert" variant="body">{error}</Text> : null}
          <Box justifyContent="end" gap="s">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={deleting ? "danger" : "primary"} disabled={!valid || busy}>
              {busy ? "Saving…" : label}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function WorkspaceDirectory() {
  const { organizations, user, scaleBillingWorkspaceId, organizationsError, organizationsLoading, refreshOrganizations, switchOrg } = useAppContext();
  const billingWorkspace = organizations.find((workspace) => workspace.id === scaleBillingWorkspaceId);
  const navigate = useNavigate();
  const [action, setAction] = useState<WorkspaceAction | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function openWorkspace(id: string, destination: string) {
    if (opening) return;
    setOpening(id);
    try {
      if (user?.org_id !== id) await switchOrg(id);
      navigate(destination);
    } catch {
      toast.error("Could not open the workspace. Refresh the directory and try again.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <PageShell density="standard">
      <Box as="section" flexDirection="column" gap="xl" padding="l">
        <Box as="header" justifyContent="between" alignItems="start" gap="m" flexWrap="wrap">
          <Box flexDirection="column" gap="xs">
            <Text as="h1" variant="heading-m">Workspaces</Text>
            <Text variant="body" color="muted">Open a workspace to manage its projects, team and billing.</Text>
          </Box>
          {billingWorkspace ? <Button onClick={() => setAction({ kind: "create", billingWorkspace })}>Create workspace</Button> : null}
        </Box>
        {organizationsLoading ? <Text role="status" variant="body" color="muted">Loading workspaces…</Text> : null}
        {organizationsError ? (
          <Box gap="s" alignItems="center">
            <Text role="alert" variant="body">Could not refresh your workspaces.</Text>
            <Button variant="outline" onClick={() => void refreshOrganizations()}>Retry</Button>
          </Box>
        ) : null}
        <Box display="grid" gap="m" gridTemplateColumns={{ base: "1fr", lg: "1fr 1fr" }}>
          {organizations.map((workspace) => {
            const current = user?.org_id === workspace.id;
            const owner = workspace.role === "owner";
            return (
              <PolarCard key={workspace.id} variant={current ? "selected" : "default"} padding="l">
                <Box flexDirection="column" gap="m">
                  <Box justifyContent="between" alignItems="start" gap="s">
                    <Box flexDirection="column" gap="xs">
                      <Text as="h2" variant="heading-xs">{workspace.name}</Text>
                      <Text color="muted" variant="caption">
                        {workspace.role} · {workspace.member_count} {workspace.member_count === 1 ? "member" : "members"}
                      </Text>
                    </Box>
                    <Box gap="xs" flexWrap="wrap">
                      {workspace.billing_workspace_id ? <Badge variant="neutral" size="compact">Shared billing</Badge> : null}
                      {current ? <Badge variant="info" size="compact">Current</Badge> : null}
                    </Box>
                  </Box>
                  <Box gap="s" flexWrap="wrap">
                    <Button variant="secondary" disabled={opening !== null}
                      onClick={() => void openWorkspace(workspace.id, workspacePath())}>
                      {opening === workspace.id ? "Opening…" : "Open workspace"}
                    </Button>
                    {owner ? (
                      <>
                        <Button variant="ghost" disabled={opening !== null}
                          onClick={() => void openWorkspace(workspace.id, billingPath())}>Billing</Button>
                        <Button variant="ghost" disabled={opening !== null}
                          onClick={() => setAction({ kind: "rename", workspace })}>Rename</Button>
                        {!current ? <Button variant="ghost" disabled={opening !== null}
                          onClick={() => setAction({ kind: "delete", workspace })}>Delete</Button> : null}
                      </>
                    ) : null}
                  </Box>
                </Box>
              </PolarCard>
            );
          })}
        </Box>
        <Button asChild variant="outline"><Link to={userSettingsPath()}>Account settings</Link></Button>
      </Box>
      {action ? <WorkspaceDialog action={action} onClose={() => setAction(null)} /> : null}
    </PageShell>
  );
}

export function WorkspaceSettings() {
  const { currentOrg, user } = useAppContext();
  const [renaming, setRenaming] = useState(false);
  return (
    <Box as="section" padding="l" flexDirection="column" gap="m">
      <Text as="h1" variant="heading-m">Workspace settings</Text>
      <Text variant="body">{currentOrg?.name ?? user?.org_name ?? "Workspace"}</Text>
      <Box gap="s" flexWrap="wrap">
        {currentOrg?.role === "owner" ? <Button onClick={() => setRenaming(true)}>Rename workspace</Button> : null}
        <Button asChild variant="outline"><Link to={organizationsPath()}>All workspaces</Link></Button>
      </Box>
      {renaming && currentOrg ? (
        <WorkspaceDialog action={{ kind: "rename", workspace: currentOrg }} onClose={() => setRenaming(false)} />
      ) : null}
    </Box>
  );
}
