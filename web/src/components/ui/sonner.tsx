import React, { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner, toast } from "sonner";
import {
  CheckCircle,
  CircleNotch,
  Info,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useThemeMode } from "@/lib/style-theme";

type ToasterProps = ComponentProps<typeof Sonner>;

const toastIcons: Record<string, ReactNode> = {
  success: React.createElement(CheckCircle, {
    className: "size-4 text-emerald-600",
    weight: "fill",
  }),
  info: React.createElement(Info, { className: "size-4 text-blue-500", weight: "fill" }),
  warning: React.createElement(Warning, {
    className: "size-4 text-amber-500",
    weight: "fill",
  }),
  error: React.createElement(WarningCircle, {
    className: "size-4 text-red-500",
    weight: "fill",
  }),
  loading: React.createElement(CircleNotch, {
    className: "size-4 animate-spin text-gray-400",
    weight: "bold",
  }),
};

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
      richColors
      closeButton
      visibleToasts={4}
      gap={10}
      icons={toastIcons}
      className="toaster group pointer-events-none"
      offset={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        right: 16,
        left: 16,
      }}
      mobileOffset={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        right: 16,
        left: 16,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-gray-200 group-[.toaster]:shadow-md group-[.toaster]:rounded-2xl text-sm font-display   ",
          description: "group-[.toast]:text-gray-500 text-xs",
          actionButton:
            "group-[.toast]:bg-black group-[.toast]:text-white text-xs font-medium rounded-full px-2.5 py-1",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-black text-xs rounded-full px-2.5 py-1",
          closeButton:
            "group-[.toast]:border-gray-200 group-[.toast]:bg-white group-[.toast]:text-gray-400",
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
