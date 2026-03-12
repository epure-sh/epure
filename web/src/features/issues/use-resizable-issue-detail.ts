import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const STORAGE_KEY = "epure-issue-detail-width";
const DEFAULT_WIDTH = 540;
/** Matches --chrome-detail-min-width in design/tokens.css */
const MIN_WIDTH = 640;

function readStoredWidth(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_WIDTH;
  }
  const parsed = Number.parseInt(stored, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_WIDTH;
}

export interface UseResizableIssueDetailResult {
  width: number;
  isFullscreen: boolean;
  isResizing: boolean;
  toggleFullscreen: () => void;
  startResize: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function useResizableIssueDetail(): UseResizableIssueDetailResult {
  const [width, setWidth] = useState(readStoredWidth);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current);
  }, []);

  const startResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (isFullscreen) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    setIsResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        window.innerWidth,
        Math.max(MIN_WIDTH, startWidth + (startX - moveEvent.clientX)),
      );
      widthRef.current = nextWidth;
      setWidth(nextWidth);
      setIsFullscreen(false);
    };

    const handleUp = () => {
      setIsResizing(false);
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [isFullscreen]);

  return {
    width,
    isFullscreen,
    isResizing,
    toggleFullscreen,
    startResize,
  };
}
