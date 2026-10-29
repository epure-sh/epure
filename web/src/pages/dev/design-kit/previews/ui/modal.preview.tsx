import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Modal } from "@/components/ui/modal";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ModalPreview() {
  const [open, setOpen] = React.useState(false);

  return (
    <PreviewBlock
      id="modal"
      title="Modal"
      description="Orbit Modal for new overlays · legacy Dialog compound API as a section."
    >
      <PreviewRow label="Basic · Modal">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Open Modal
        </Button>
        <Modal
          title="Modal"
          isShown={open}
          hide={() => setOpen(false)}
          modalContent={
            <div className="space-y-3 p-1">
              <p className="text-xs text-fg-muted">Prefer Modal for new overlays.</p>
              <Button size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          }
        />
      </PreviewRow>
      <PreviewRow label="Legacy · Dialog" className="mt-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Open Dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog</DialogTitle>
              <DialogDescription>
                Legacy compound API — keep for existing call sites.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </PreviewRow>
    </PreviewBlock>
  );
}
