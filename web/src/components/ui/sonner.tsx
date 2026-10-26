// src/components/ui/sonner.tsx
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-overlay group-[.toaster]:text-fg-primary group-[.toaster]:border-border-subtle group-[.toaster]:shadow-float group-[.toaster]:rounded-control text-[13px] font-sans",
          description: "group-[.toast]:text-fg-muted text-[11px]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-fg text-xs font-medium rounded-xs px-2 py-1",
          cancelButton:
            "group-[.toast]:bg-surface-2 group-[.toast]:text-fg-secondary text-xs rounded-xs px-2 py-1",
        },
      }}
      {...props}
    />
  );
}

export { toast };
