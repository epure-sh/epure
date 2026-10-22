import { TeamSettings } from "../settings/team";
import { PageChrome } from "../../ui/page-chrome";
import { useAppContext } from "../../shell/app-context";

export function OrgTeamPage() {
  const { currentOrg, user } = useAppContext();
  const orgName = currentOrg?.name ?? user?.org_name;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title={orgName ? `${orgName} Team` : "Team"}
        description={
          orgName
            ? `Manage members, roles, and pending invitations for ${orgName}. Users can belong to multiple workspaces.`
            : "Manage who has access to this workspace, their roles, and pending invitations."
        }
      />

      <div className="flex-1 overflow-auto bg-bg p-4">
        <div className="mx-auto max-w-default space-y-4">
          <TeamSettings />
        </div>
      </div>
    </div>
  );
}
