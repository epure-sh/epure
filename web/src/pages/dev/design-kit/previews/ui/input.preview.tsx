import { Input } from "@/components/ui/input";
import { MagnifyingGlass } from "@/components/ui/icon";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function InputPreview() {
  return (
    <PreviewBlock id="input" title="Input">
      <PreviewRow label="Sizes">
        <Input size="sm" placeholder="Search…" leadingIcon={<MagnifyingGlass />} trailingShortcut="/" className="w-48" />
        <Input size="md" placeholder="webhook URL" className="w-48" />
        <Input size="auto" placeholder="auto height" className="w-48" />
      </PreviewRow>
      <PreviewRow label="Variant ghost">
        <Input variant="ghost" size="sm" placeholder="Ghost filter…" className="w-48" />
      </PreviewRow>
      <PreviewRow label="Disabled">
        <Input size="sm" disabled placeholder="Disabled" className="w-48" />
      </PreviewRow>
    </PreviewBlock>
  );
}
