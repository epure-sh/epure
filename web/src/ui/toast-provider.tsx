import { createContext, useContext, type ReactNode } from "react";
import { toast as sonnerToast } from "@/components/ui/sonner";

export type ToastApi = typeof sonnerToast;

export interface ToastContextValue {
  /** Full Sonner toast API (`toast`, `toast.success`, `toast.error`, `toast.promise`, …). */
  toast: ToastApi;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** @deprecated Prefer `toast` from `@/components/ui/sonner`. Kept for existing `useToast()` call sites. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastContext.Provider value={{ toast: sonnerToast }}>{children}</ToastContext.Provider>
  );
}

const DEFAULT_TOAST_CONTEXT: ToastContextValue = {
  toast: sonnerToast,
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? DEFAULT_TOAST_CONTEXT;
}
