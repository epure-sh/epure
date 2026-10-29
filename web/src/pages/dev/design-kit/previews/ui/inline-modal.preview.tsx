import * as React from "react";
import { InlineModal, InlineModalHeader } from "@polar-sh/orbit";
import { Button } from "@/components/ui/button";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function InlineModalPreview() {
  const [open, setOpen] = React.useState(false);

  return (
    <PreviewBlock
      id="inline-modal"
      title="InlineModal"
      description="Portal modal with focus lock — open to inspect."
    >
      <PreviewRow label="Basic">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Open inline modal
        </Button>
      </PreviewRow>
      <InlineModal
        isShown={open}
        hide={() => setOpen(false)}
        modalContent={
          <div className="space-y-3 p-1">
            <InlineModalHeader hide={() => setOpen(false)}>
              <span className="text-sm font-medium">Inline modal</span>
            </InlineModalHeader>
            <p className="text-xs text-fg-muted">
              Content rendered in a focused overlay.
            </p>
            <Button size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        }
      />
    </PreviewBlock>
  );
}
