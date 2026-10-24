// src/components/kit/use-epure-shortcut.ts
import { useHotkeys, type Options } from "react-hotkeys-hook";

/**
 * Epure standard hotkey hook.
 * Automatically suppresses hotkeys when focus is inside an interactive input,
 * textarea, select, contenteditable element, or dialog.
 */
export function useEpureShortcut(
  keys: string,
  callback: (event: KeyboardEvent) => void,
  options?: Options
) {
  return useHotkeys(
    keys,
    (event) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest("[role='dialog']") !== null)
      ) {
        return;
      }
      callback(event);
    },
    {
      enableOnFormTags: false,
      preventDefault: true,
      ...options,
    }
  );
}
