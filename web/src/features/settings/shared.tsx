import { type FormEvent, type ReactNode, useState } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { cn } from "../../lib/cn";

export function SettingsTabHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-medium tracking-ui text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
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
        "border border-border border-l-[3px] bg-surface p-3 text-sm text-ink-muted",
        variant === "warning" ? "border-l-semantic-warning" : "border-l-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MemberAccessNotice({ resource = "these settings" }: { resource?: string }) {
  return (
    <div className="space-y-4">
      <SettingsTabHeader title="Access restricted" description="Your role limits what you can change." />
      <InfoCallout>
        You have member access. Managing {resource} requires an admin or owner role. Ask a workspace
        admin if you need changes.
      </InfoCallout>
    </div>
  );
}

export function DangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-semantic-danger/30">
      <CardHeader>
        <CardTitle className="text-semantic-danger">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-sm text-ink", mono && "font-mono text-xs text-ink-muted")}>
        {value}
      </p>
    </div>
  );
}

export function EnvironmentReference() {
  const tags = ["production", "staging", "local"] as const;

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-muted">
        Environments are set in your SDK init, not in epure. Tag events with{" "}
        <span className="font-mono text-xs text-ink">environment</span> so you can filter issues by
        deploy target.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="env" className="font-mono capitalize">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
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
            This permanently deletes the project, its issues, events, and DSN keys. Type the project
            name to confirm.
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
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={busy || confirmName.trim() !== projectName}
            >
              Delete permanently
            </Button>
          </div>
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
