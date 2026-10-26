import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner, toast } from "sonner";
import { useThemeMode } from "@/lib/style-theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  const [mounted, setMounted] = useState(false);
  const [themeMode] = useThemeMode();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toaster = (
    <Sonner
      theme={themeMode === "light" ? "light" : "dark"}
      position="bottom-right"
      className="toaster group pointer-events-none"
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto group-[.toaster]:bg-surface-1 group-[.toaster]:text-fg-primary group-[.toaster]:border-border-strong group-[.toaster]:shadow-float group-[.toaster]:rounded-control text-xs font-sans",
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

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(toaster, document.body);
}

export { toast };
