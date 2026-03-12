import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

export interface ResolveWithAiDialogProps {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
}

export function ResolveWithAiDialog({
  count,
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: ResolveWithAiDialogProps) {
  const issueNoun = count === 1 ? "issue" : "issues";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve {count} {issueNoun} with AI?</DialogTitle>
          <DialogDescription>
            This marks selected issues as ignored while you fix them in your editor. Only continue
            if you’ll actually resolve them.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : "Copy for AI & ignore"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
