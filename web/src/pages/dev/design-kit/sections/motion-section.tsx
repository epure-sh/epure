import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PreviewBlock, PreviewRow } from "../shared";

const EASINGS = [
  { name: "--ease-mechanical", token: "mechanical" },
  { name: "--ease-out", token: "out" },
  { name: "--ease-out-soft", token: "out-soft" },
  { name: "--ease-in-out", token: "in-out" },
  { name: "--ease-drawer", token: "drawer" },
] as const;

const DURATIONS = [
  { name: "--duration-fast", ms: "80ms" },
  { name: "--duration-base", ms: "120ms" },
  { name: "--duration-panel", ms: "160ms" },
  { name: "--spring-response", ms: "0.35s" },
] as const;

function EaseLane({ name, token }: { name: string; token: string }) {
  const [run, setRun] = React.useState(0);
  const barRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.animation = "none";
    // Force reflow then apply token easing
    void el.offsetWidth;
    el.style.animation = `dk-ease-travel 900ms var(${name}) both`;
  }, [run, name]);

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full flex-col items-stretch gap-1 rounded-control border border-border-subtle bg-surface-2/30 p-2 hover:bg-surface-2"
      onClick={() => setRun((n) => n + 1)}
    >
      <p className="font-mono text-[10px] text-fg-muted">{name}</p>
      <div className="relative h-6 overflow-hidden rounded-xs bg-bg-subtle" data-ease={token}>
        <span ref={barRef} key={run} className="absolute top-1 left-1 size-4 rounded-xs bg-accent" />
      </div>
      <p className="text-left text-[10px] text-fg-muted">Click to replay</p>
    </Button>
  );
}

const SPRING_PRESETS = [120, 200, 350, 500] as const;

export function MotionSection() {
  const [springMs, setSpringMs] = React.useState<(typeof SPRING_PRESETS)[number]>(350);
  const [forceReduce, setForceReduce] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--spring-response", `${springMs / 1000}s`);
    return () => {
      root.style.removeProperty("--spring-response");
    };
  }, [springMs]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (forceReduce) {
      root.style.setProperty("--duration-fast", "0ms");
      root.style.setProperty("--duration-base", "0ms");
      root.style.setProperty("--duration-panel", "0ms");
      root.style.setProperty("--spring-response", "0ms");
    } else {
      root.style.removeProperty("--duration-fast");
      root.style.removeProperty("--duration-base");
      root.style.removeProperty("--duration-panel");
    }
  }, [forceReduce]);

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes dk-ease-travel {
          from { transform: translateX(0); }
          to { transform: translateX(min(12rem, 70%)); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes dk-ease-travel {
            from { transform: none; opacity: 1; }
            to { transform: none; opacity: 0.55; }
          }
        }
      `}</style>

      <header className="space-y-1 border-b border-border-subtle pb-2">
        <h2 className="text-sm font-semibold text-fg-primary">Motion lab</h2>
        <p className="max-w-2xl text-xs text-fg-muted">
          Wired to <code className="font-mono text-[11px]">design/tokens.css</code>. Overlays
          (dialog, sheet, popover…) use tw-animate-css + these easings — open any in Primitives.
        </p>
      </header>

      <PreviewBlock
        id="motion-durations"
        title="Duration tokens"
        description="Fast chrome · base control · panel / overlay. prefers-reduced-motion zeros them."
      >
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <div
              key={d.name}
              className="rounded-control border border-border-subtle bg-surface-2/40 px-2.5 py-2"
            >
              <p className="font-mono text-[10px] text-fg-muted">{d.name}</p>
              <p className="text-xs font-medium tabular-nums text-fg-primary">{d.ms}</p>
            </div>
          ))}
        </div>
        <PreviewRow label="Press feedback" className="mt-3">
          <Button variant="secondary" size="sm">
            Default press
          </Button>
          <Button variant="primary" size="sm" className="btn-tactile">
            btn-tactile
          </Button>
          <Button variant="outline" size="sm" className="active:scale-[0.97]">
            scale 0.97
          </Button>
        </PreviewRow>
      </PreviewBlock>

      <PreviewBlock
        id="motion-easings"
        title="Easing curves"
        description="Click a lane to replay travel with that token. Mechanical is the default control curve."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EASINGS.map((e) => (
            <EaseLane key={e.name} name={e.name} token={e.token} />
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        id="motion-spring"
        title="Spring response"
        description="Live --spring-response (tabs indicator, switch thumb). Session override only."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1.5">
            <p className="text-xs text-fg-muted">Response {springMs}ms</p>
            <div className="flex flex-wrap gap-1.5">
              {SPRING_PRESETS.map((ms) => (
                <Button
                  key={ms}
                  type="button"
                  size="xs"
                  variant={springMs === ms ? "primary" : "outline"}
                  disabled={forceReduce}
                  onClick={() => setSpringMs(ms)}
                >
                  {ms}ms
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="force-reduce"
              checked={forceReduce}
              onCheckedChange={setForceReduce}
            />
            <Label htmlFor="force-reduce" className="text-xs">
              Force reduced motion (session)
            </Label>
          </div>
        </div>
        <PreviewRow label="Utilities" className="mt-3">
          <span className="inline-flex size-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
          <span className="inline-flex size-2 animate-pulse rounded-full bg-accent" />
          <span className="relative inline-flex size-6 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-healthy opacity-40" />
            <span className="relative size-2 rounded-full bg-healthy" />
          </span>
        </PreviewRow>
      </PreviewBlock>
    </div>
  );
}
