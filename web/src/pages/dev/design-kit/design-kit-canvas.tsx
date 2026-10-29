import * as React from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;
/** Button / ⌘+/- step — kept small so one click doesn’t jump. */
const ZOOM_STEP = 0.05;

/** Interactive content that should not start a canvas pan (except Space-grab). */
const PAN_EXCLUDED = [
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "a",
  "label",
  "no-pan",
  "[role='dialog']",
  "[role='menu']",
  "[role='listbox']",
  "[role='tab']",
];

/** Labeled Figma-style tile on the infinite board (one component / district). */
export function CanvasArtboard({
  id,
  title,
  subtitle,
  className,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      data-design-kit-artboard={id || undefined}
      className={cn("relative min-w-0 shrink-0 self-start", className)}
    >
      <div className="mb-1.5 flex items-baseline gap-2 px-0.5">
        <span className="font-mono text-[11px] font-medium tracking-wide text-fg-muted">
          {title}
        </span>
        {subtitle ? (
          <span className="truncate text-[10px] text-fg-muted/70">{subtitle}</span>
        ) : null}
      </div>
      <div className="rounded-[12px] border border-border-subtle bg-surface-1 p-3.5 shadow-[var(--shadow-specular,0_1px_0_oklch(1_0_0/0.06)_inset)]">
        {children}
      </div>
    </div>
  );
}

function ZoomToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onFit,
  onHundred,
  spacePanning,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onHundred: () => void;
  spacePanning: boolean;
}) {
  const pct = Math.round(scale * 100);
  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-control border border-border-subtle bg-surface-1/95 px-1.5 py-1 shadow-tactile backdrop-blur-sm">
      <Button type="button" variant="ghost" size="xs" onClick={onZoomOut} aria-label="Zoom out">
        −
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="min-w-[3.25rem] font-mono text-[11px] tabular-nums"
        onClick={onHundred}
        title="Reset to 100%"
      >
        {pct}%
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={onZoomIn} aria-label="Zoom in">
        +
      </Button>
      <div className="mx-0.5 h-4 w-px bg-border-subtle" />
      <Button type="button" variant="ghost" size="xs" onClick={onFit}>
        Fit
      </Button>
      <span
        className={cn(
          "ml-1 hidden rounded-control px-1.5 py-0.5 font-mono text-[10px] sm:inline",
          spacePanning ? "bg-accent-muted text-fg-primary" : "text-fg-muted",
        )}
        title="Hold Space and drag to pan"
      >
        {spacePanning ? "PAN" : "Space·pan"}
      </span>
    </div>
  );
}

export type DesignKitCanvasApi = {
  focus: (id: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reset: () => void;
};

export const DesignKitCanvas = React.forwardRef<
  DesignKitCanvasApi,
  {
    children: React.ReactNode;
    onActiveChange?: (id: string) => void;
    className?: string;
  }
>(function DesignKitCanvas({ children, onActiveChange, className }, ref) {
  const transformRef = React.useRef<ReactZoomPanPinchRef | null>(null);
  const [scale, setScale] = React.useState(0.45);
  const [spacePanning, setSpacePanning] = React.useState(false);

  const focus = React.useCallback(
    (id: string) => {
      const api = transformRef.current;
      if (!api) return;
      const el =
        document.querySelector<HTMLElement>(`[data-design-kit-artboard="${CSS.escape(id)}"]`) ??
        document.getElementById(id);
      if (el) {
        void api.zoomToElement(el, undefined, 280);
        onActiveChange?.(id);
      }
    },
    [onActiveChange],
  );

  const fit = React.useCallback(() => {
    const api = transformRef.current;
    if (!api) return;
    const board = document.getElementById("design-kit-board");
    if (board) {
      void api.zoomToElement(board, undefined, 320);
    } else {
      void api.resetTransform(280);
    }
  }, []);

  const reset = React.useCallback(() => {
    void transformRef.current?.setTransform(80, 60, 1, 280);
    setScale(1);
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      focus,
      zoomIn: () => {
        transformRef.current?.zoomIn(ZOOM_STEP);
      },
      zoomOut: () => {
        transformRef.current?.zoomOut(ZOOM_STEP);
      },
      fit,
      reset,
    }),
    [focus, fit, reset],
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSpacePanning(true);
      }
      if ((e.metaKey || e.ctrlKey) && !isTypingTarget(e.target)) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          transformRef.current?.zoomIn(ZOOM_STEP);
        } else if (e.key === "-") {
          e.preventDefault();
          transformRef.current?.zoomOut(ZOOM_STEP);
        } else if (e.key === "0") {
          e.preventDefault();
          fit();
        } else if (e.key === "1") {
          e.preventDefault();
          reset();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePanning(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [fit, reset]);

  return (
    <div className={cn("relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--border)_70%,transparent)_1px,transparent_0)] bg-size-[20px_20px] opacity-55"
      />

      <TransformWrapper
        ref={transformRef}
        initialScale={0.45}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        limitToBounds={false}
        centerOnInit={false}
        fitOnInit
        smooth
        wheel={{ step: 0.01 }}
        pinch={{ step: 1.5 }}
        doubleClick={{ disabled: true }}
        panning={{
          disabled: false,
          velocityDisabled: true,
          excluded: spacePanning ? [] : PAN_EXCLUDED,
        }}
        onTransform={(_ref, state) => {
          setScale(state.scale);
        }}
        onInit={(api) => {
          transformRef.current = api;
          setScale(api.state.scale);
        }}
      >
        {({ zoomIn, zoomOut }) => (
          <>
            <TransformComponent
              wrapperClass={cn(
                "!h-full !w-full",
                spacePanning ? "!cursor-grab" : "!cursor-default",
              )}
              contentClass="!h-auto !w-auto"
            >
              <div id="design-kit-board" className="h-max w-max origin-top-left p-12">
                {children}
              </div>
            </TransformComponent>

            <ZoomToolbar
              scale={scale}
              onZoomIn={() => zoomIn(ZOOM_STEP)}
              onZoomOut={() => zoomOut(ZOOM_STEP)}
              onFit={fit}
              onHundred={reset}
              spacePanning={spacePanning}
            />
          </>
        )}
      </TransformWrapper>

      <p className="pointer-events-none absolute left-3 top-3 z-10 hidden rounded-control border border-border-subtle bg-surface-1/80 px-2 py-1 font-mono text-[10px] text-fg-muted backdrop-blur-sm md:block">
        Scroll zoom · drag empty to pan · Space grabs · ⌘0 fit · ⌘1 100%
      </p>
    </div>
  );
});

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
