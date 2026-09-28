import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

export interface DeleteProjectsDialogProps {
  projectNames: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}

export function DeleteProjectsDialog({
  projectNames,
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: DeleteProjectsDialogProps) {
  const count = projectNames.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {count} project{count === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            This permanently removes each project, its issues, events, and DSN keys. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        {count > 0 ? (
          <ul className="max-h-40 list-inside list-disc overflow-auto text-sm text-ink-muted">
            {projectNames.map((name) => (
              <li key={name} className="truncate">
                {name}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy || count === 0}
            onClick={() => void onConfirm()}
          >
            {busy ? "Deleting…" : `Delete ${count} project${count === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
