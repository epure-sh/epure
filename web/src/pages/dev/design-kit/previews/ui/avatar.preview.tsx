import { Avatar } from "@polar-sh/orbit/Avatar";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function AvatarPreview() {
  return (
    <PreviewBlock id="avatar" title="Avatar" description="Polar Orbit Avatar.">
      <PreviewRow label="Initials">
        <Avatar name="Ada Lovelace" avatar_url={null} height={32} width={32} />
        <Avatar name="Grace Hopper" avatar_url={null} height={40} width={40} />
      </PreviewRow>
    </PreviewBlock>
  );
}
