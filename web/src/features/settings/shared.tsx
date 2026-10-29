import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { cn } from "../../lib/cn";
import { SectionCard } from "@/components/kit/section-card";

/** Full-width stack for project settings — cards and rows fill the content pane. */
export function SettingsStack({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full space-y-3 [&_[data-slot=section-card]]:w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SettingsSkeleton() {
  return <div className="h-24 animate-pulse rounded-md border border-border-subtle bg-surface-1" />;
}

export function InfoCallout({
  children,
  variant = "info",
  className,
}: {
  children: ReactNode;
  variant?: "info" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-border-subtle border-l-[3px] bg-surface-1 px-3 py-2 text-xs text-fg-muted",
        variant === "warning" ? "border-l-semantic-warning" : "border-l-primary",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MemberAccessNotice({ resource = "these settings" }: { resource?: string }) {
  return (
    <InfoCallout>
      Member access only. Managing {resource} needs an admin or owner.
    </InfoCallout>
  );
}

export function DangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} description={description} danger contentClassName="space-y-2">
      {children}
    </SectionCard>
  );
}

export function DeleteProjectDialog({
  projectName,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  const [confirmName, setConfirmName] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmName.trim() !== projectName) {
      return;
    }
    await onConfirm();
    setConfirmName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            Permanently deletes issues, events, and DSN keys. Type the project name to confirm.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Project name" htmlFor="delete-project-name">
            <Input
              id="delete-project-name"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={projectName}
              autoComplete="off"
              className="h-8 text-xs"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={busy || confirmName.trim() !== projectName}
            >
              Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function isValidWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Kept for legacy unwired settings panels. */
export function ReadOnlyDetail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-2xs text-fg-muted">{label}</p>
      <p className={cn("mt-0.5 text-xs text-fg-primary", mono && "font-mono text-fg-muted")}>
        {value}
      </p>
    </div>
  );
}

/** Kept for legacy unwired settings panels. */
export function EnvironmentReference() {
  return (
    <p className="text-xs text-fg-muted">
      Tag events with <span className="font-mono text-fg-primary">environment</span> in the SDK.
    </p>
  );
}

