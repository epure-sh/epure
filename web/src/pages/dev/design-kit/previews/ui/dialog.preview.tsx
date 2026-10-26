import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PreviewBlock } from "../../shared";

export default function DialogPreview() {
  const [open, setOpen] = React.useState(false);
  return (
    <PreviewBlock id="dialog" title="Dialog">
      <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="secondary">Open</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Triage</DialogTitle><DialogDescription>Review spike</DialogDescription></DialogHeader>
        <DialogFooter><Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" variant="primary" onClick={() => setOpen(false)}>Apply</Button></DialogFooter>
      </DialogContent></Dialog>
    </PreviewBlock>
  );
}