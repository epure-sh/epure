import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ToastPreview() {
  return (
    <PreviewBlock
      id="toast"
      title="Toast"
      description="Transient notification via sonner."
    >
      <PreviewRow label="State">
        <Button size="sm" variant="secondary" onClick={() => toast.success("Saved")}>
          Success
        </Button>
        <Button size="sm" variant="secondary" onClick={() => toast.error("Failed")}>
          Error
        </Button>
        <Button size="sm" variant="secondary" onClick={() => toast.info("Info")}>
          Info
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => toast.message("Neutral", { description: "Supporting line" })}
        >
          Message
        </Button>
      </PreviewRow>
    </PreviewBlock>
  );
}
