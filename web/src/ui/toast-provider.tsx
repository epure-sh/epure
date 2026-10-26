import { createContext, useCallback, useContext, type ReactNode } from "react";
import { toast as sonnerToast } from "@/components/ui/sonner";

export interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function showToast(message: string) {
  sonnerToast(message);
}

/** @deprecated Prefer `toast` from `@/components/ui/sonner`. Kept for existing `useToast()` call sites. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useCallback((message: string) => {
    showToast(message);
  }, []);

  return <ToastContext.Provider value={{ toast }}>{children}</ToastContext.Provider>;
}

const DEFAULT_TOAST_CONTEXT: ToastContextValue = {
  toast: showToast,
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? DEFAULT_TOAST_CONTEXT;
}
