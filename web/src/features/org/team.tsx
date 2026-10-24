import { TeamSettings } from "../settings/team";
import { PageShell } from "@/components/kit/page-shell";
import { useAppContext } from "../../shell/app-context";

export function OrgTeamPage() {
  const { currentOrg, user } = useAppContext();
  const orgName = currentOrg?.name ?? user?.org_name;

  return (
    <PageShell
      title={orgName ? `${orgName} Team` : "Team"}
      description={
        orgName
          ? `Manage members, roles, and pending invitations for ${orgName}. Users can belong to multiple workspaces.`
          : "Manage who has access to this workspace, their roles, and pending invitations."
      }
      density="standard"
    >
      <TeamSettings />
    </PageShell>
  );
}
