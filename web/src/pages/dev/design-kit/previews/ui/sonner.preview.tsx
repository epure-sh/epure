import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SonnerPreview() {
  return (
    <PreviewBlock id="sonner" title="Sonner toasts">
      <PreviewRow label="Triggers">
        <Button size="sm" variant="secondary" onClick={() => toast.success("Saved")}>Success</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.error("Failed")}>Error</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.info("Info")}>Info</Button>
      </PreviewRow>
    </PreviewBlock>
  );
}