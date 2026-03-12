import { TeamSettings } from "../settings/team";
import { PageChrome } from "../../ui/page-chrome";

export function OrgTeamPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Team"
        description="Manage who has access to this workspace, their roles, and pending invitations."
      />

      <div className="flex-1 overflow-auto bg-bg p-4">
        <div className="mx-auto max-w-default space-y-4">
          <TeamSettings />
        </div>
      </div>
    </div>
  );
}
