import { Avatar } from "@/components/ui/avatar";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function AvatarPreview() {
  return (
    <PreviewBlock id="avatar" title="Avatar" description="Orbit Avatar">
      <PreviewRow label="Initials">
        <Avatar name="Ada Lovelace" avatar_url={null} height={32} width={32} />
      </PreviewRow>
    </PreviewBlock>
  );
}
