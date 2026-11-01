import { toast } from "@/components/ui/sonner";

type ToastFn = typeof toast | typeof toast.success;

export type UndoToastOptions = {
  description?: string;
  duration?: number;
  /** Defaults to success toast. Pass `toast` for neutral. */
  method?: ToastFn;
};

/**
 * Success/info toast with a standard Undo action for reversible mutations.
 */
export function toastWithUndo(
  message: string,
  onUndo: () => unknown,
  options: UndoToastOptions = {},
): ReturnType<typeof toast> {
  const method = options.method ?? toast.success;
  return method(message, {
    description: options.description,
    duration: options.duration ?? 8_000,
    action: {
      label: "Undo",
      onClick: () => {
        void Promise.resolve(onUndo()).catch(() => {
          toast.error("Failed to undo");
        });
      },
    },
  });
}
