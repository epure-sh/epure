import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/kit/section-card";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SectionCardPreview() {
  return (
    <PreviewBlock id="section-card" title="SectionCard">
      <PreviewRow label="Default"><SectionCard title="DSN keys" description="Rotate keys"><Button size="sm" variant="secondary">Action</Button></SectionCard></PreviewRow>
      <PreviewRow label="Danger"><SectionCard title="Delete project" description="Irreversible" danger><Button size="sm" variant="danger">Delete</Button></SectionCard></PreviewRow>
    </PreviewBlock>
  );
}