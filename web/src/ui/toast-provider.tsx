import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Toast } from "./toast";

interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const toast = useCallback(
    (nextMessage: string) => {
      clearTimer();
      setMessage(nextMessage);
      setVisible(true);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        timerRef.current = window.setTimeout(() => setMessage(null), 160);
      }, TOAST_DURATION_MS);
    },
    [clearTimer],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message
        ? createPortal(
            <div
              className="epure-toast-host pointer-events-none fixed bottom-4 left-1/2 z-[100] -translate-x-1/2"
              aria-live="polite"
            >
              <Toast
                message={message}
                className={
                  visible
                    ? "translate-y-0 opacity-100 transition-all duration-panel ease-mechanical"
                    : "translate-y-2 opacity-0 transition-all duration-panel ease-mechanical"
                }
              />
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
