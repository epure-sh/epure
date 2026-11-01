import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type PlaygroundControlOption<T extends string = string> = {
  value: T;
  label?: string;
  badge?: string;
};

export type PlaygroundControlAxis<T extends string = string> = {
  id: string;
  label: string;
  options: readonly PlaygroundControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export type PlaygroundControlFlag = {
  id: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
};

export type ComponentPlaygroundControlsProps = {
  axes?: readonly PlaygroundControlAxis[];
  flags?: readonly PlaygroundControlFlag[];
  /** When true, shows an interactive depression probe for tactile :active scale checks. */
  showDepressionProbe?: boolean;
  /** Custom heading or label for the depression probe section */
  depressionProbeTitle?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Interactive Tactile Depression Probe with real-time pointer event inspection
 * and scale(0.97) mechanical depression telemetry.
 */
function TactileDepressionProbe({ title }: { title?: string }) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [pressCount, setPressCount] = React.useState(0);

  const handlePointerDown = () => {
    setIsPressed(true);
    setPressCount((c) => c + 1);
  };
  const handlePointerUp = () => setIsPressed(false);
  const handlePointerLeave = () => setIsPressed(false);

  return (
    <div className="border-t border-border-subtle pt-2.5">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
        <p className="font-mono text-[10px] uppercase tracking-wide text-fg-muted">
          {title ?? "Tactile Depression Probe · :active scale(0.97)"}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium tracking-wide transition-colors",
              isPressed
                ? "bg-accent/20 text-accent font-semibold"
                : "bg-surface-2 text-fg-muted",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-transform",
                isPressed ? "bg-accent scale-125" : "bg-fg-muted/40",
              )}
            />
            {isPressed ? "PRESSED · scale(0.970)" : "IDLE · scale(1.000)"}
          </span>
          {pressCount > 0 && (
            <span className="font-mono text-[9px] tabular-nums text-fg-muted">
              {pressCount} {pressCount === 1 ? "press" : "presses"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          className="btn-tactile active:scale-[0.97] transition-transform duration-100 ease-[var(--ease-mechanical,cubic-bezier(0.16,1,0.3,1))]"
        >
          Press me · active:scale(0.97)
        </Button>
        <span className="font-mono text-[10px] text-fg-muted">
          Damped: 100ms cubic-bezier(0.16, 1, 0.3, 1)
        </span>
      </div>
    </div>
  );
}

/**
 * Interactive toolbar for design-kit previews: variant / size / effect / state toggles
 * plus mechanical pointer-down depression probe.
 */
export function ComponentPlaygroundControls({
  axes = [],
  flags = [],
  showDepressionProbe = false,
  depressionProbeTitle,
  className,
  compact = false,
}: ComponentPlaygroundControlsProps) {
  if (axes.length === 0 && flags.length === 0 && !showDepressionProbe) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Component playground controls"
      className={cn(
        "mb-3 flex flex-col gap-2 rounded-control border border-border-subtle bg-surface-1/80 p-2.5 backdrop-blur-xs",
        compact && "p-2 gap-1.5",
        className,
      )}
    >
      {axes.map((axis) => (
        <div key={axis.id} className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-wide text-fg-muted">
            {axis.label}
          </p>
          <div className="flex flex-wrap gap-1">
            {axis.options.map((opt) => {
              const selected = axis.value === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  size="xs"
                  variant={selected ? "secondary" : "ghost"}
                  aria-pressed={selected}
                  onClick={() => axis.onChange(opt.value)}
                  className={cn(
                    "font-mono text-[11px]",
                    selected && "font-semibold shadow-xs",
                  )}
                >
                  {opt.label ?? opt.value}
                  {opt.badge ? (
                    <span className="ml-1 text-[9px] opacity-70">({opt.badge})</span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </div>
      ))}

      {flags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-2">
          {flags.map((flag) => (
            <label
              key={flag.id}
              className="flex items-center gap-2 text-[11px] text-fg-muted cursor-pointer select-none"
            >
              <Switch
                checked={flag.value}
                onCheckedChange={flag.onChange}
                aria-label={flag.label}
              />
              <span className="font-mono uppercase tracking-wide">{flag.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {showDepressionProbe ? (
        <TactileDepressionProbe title={depressionProbeTitle} />
      ) : null}
    </div>
  );
}

// ─── Universal & Preset Hooks ───────────────────────────────────────────────

export type GenericPlaygroundConfig<
  V extends string = string,
  S extends string = string,
  T extends string = string,
  E extends string = string,
> = {
  variants?: readonly { value: V; label?: string }[];
  initialVariant?: V;
  sizes?: readonly { value: S; label?: string }[];
  initialSize?: S;
  tones?: readonly { value: T; label?: string }[];
  initialTone?: T;
  effects?: readonly { value: E; label?: string }[];
  initialEffect?: E;
  initialLoading?: boolean;
  initialDisabled?: boolean;
  initialError?: boolean;
  initialSkeleton?: boolean;
  customAxes?: PlaygroundControlAxis[];
  customFlags?: PlaygroundControlFlag[];
  showDepressionProbe?: boolean;
};

/**
 * Universal, strongly-typed playground controls hook covering all 5 dimensions.
 */
export function useComponentPlayground<
  V extends string = string,
  S extends string = string,
  T extends string = string,
  E extends string = string,
>(config: GenericPlaygroundConfig<V, S, T, E>) {
  const [variant, setVariant] = React.useState<V>(
    config.initialVariant ?? (config.variants?.[0]?.value as V),
  );
  const [size, setSize] = React.useState<S>(
    config.initialSize ?? (config.sizes?.[0]?.value as S),
  );
  const [tone, setTone] = React.useState<T>(
    config.initialTone ?? (config.tones?.[0]?.value as T),
  );
  const [effect, setEffect] = React.useState<E>(
    config.initialEffect ?? (config.effects?.[0]?.value as E),
  );
  const [loading, setLoading] = React.useState(config.initialLoading ?? false);
  const [disabled, setDisabled] = React.useState(config.initialDisabled ?? false);
  const [error, setError] = React.useState(config.initialError ?? false);
  const [skeleton, setSkeleton] = React.useState(config.initialSkeleton ?? false);

  const axes: PlaygroundControlAxis[] = [];

  if (config.variants && config.variants.length > 0) {
    axes.push({
      id: "variant",
      label: "Variant",
      value: variant,
      onChange: (val) => setVariant(val as V),
      options: config.variants,
    });
  }

  if (config.sizes && config.sizes.length > 0) {
    axes.push({
      id: "size",
      label: "Size",
      value: size,
      onChange: (val) => setSize(val as S),
      options: config.sizes,
    });
  }

  if (config.tones && config.tones.length > 0) {
    axes.push({
      id: "tone",
      label: "Tone",
      value: tone,
      onChange: (val) => setTone(val as T),
      options: config.tones,
    });
  }

  if (config.effects && config.effects.length > 0) {
    axes.push({
      id: "effect",
      label: "Effect",
      value: effect,
      onChange: (val) => setEffect(val as E),
      options: config.effects,
    });
  }

  if (config.customAxes) {
    axes.push(...config.customAxes);
  }

  const flags: PlaygroundControlFlag[] = [
    { id: "loading", label: "Loading", value: loading, onChange: setLoading },
    { id: "disabled", label: "Disabled", value: disabled, onChange: setDisabled },
    { id: "error", label: "Error", value: error, onChange: setError },
  ];

  if (config.initialSkeleton !== undefined) {
    flags.push({ id: "skeleton", label: "Skeleton", value: skeleton, onChange: setSkeleton });
  }

  if (config.customFlags) {
    flags.push(...config.customFlags);
  }

  return {
    variant,
    setVariant,
    size,
    setSize,
    tone,
    setTone,
    effect,
    setEffect,
    loading,
    setLoading,
    disabled,
    setDisabled,
    error,
    setError,
    skeleton,
    setSkeleton,
    axes,
    flags,
    showDepressionProbe: config.showDepressionProbe ?? false,
  };
}

// ─── Button Playground (100% Backwards Compatible) ──────────────────────────

export type InteractiveButtonPlaygroundState = {
  variant: string;
  size: string;
  loading: boolean;
  disabled: boolean;
  error?: boolean;
};

export function useInteractiveButtonPlayground(
  initial?: Partial<InteractiveButtonPlaygroundState>,
) {
  const [variant, setVariant] = React.useState(initial?.variant ?? "secondary");
  const [size, setSize] = React.useState(initial?.size ?? "sm");
  const [loading, setLoading] = React.useState(initial?.loading ?? false);
  const [disabled, setDisabled] = React.useState(initial?.disabled ?? false);
  const [error, setError] = React.useState(initial?.error ?? false);

  const axes: PlaygroundControlAxis[] = [
    {
      id: "variant",
      label: "Variant",
      value: variant,
      onChange: setVariant,
      options: [
        { value: "default", label: "primary" },
        { value: "secondary" },
        { value: "outline" },
        { value: "ghost" },
        { value: "destructive", label: "danger" },
        { value: "link" },
      ],
    },
    {
      id: "size",
      label: "Size",
      value: size,
      onChange: setSize,
      options: [
        { value: "xs" },
        { value: "sm" },
        { value: "default", label: "md" },
        { value: "lg" },
        { value: "icon" },
      ],
    },
  ];

  const flags: PlaygroundControlFlag[] = [
    { id: "loading", label: "Loading", value: loading, onChange: setLoading },
    { id: "disabled", label: "Disabled", value: disabled, onChange: setDisabled },
    { id: "error", label: "Error", value: error, onChange: setError },
  ];

  return { variant, size, loading, disabled, error, axes, flags };
}

// ─── Card Playground ────────────────────────────────────────────────────────

export function useCardPlayground() {
  return useComponentPlayground({
    variants: [
      { value: "default" },
      { value: "interactive" },
      { value: "selected" },
      { value: "inset" },
      { value: "flat" },
    ],
    initialVariant: "default",
    sizes: [
      { value: "xs", label: "compact" },
      { value: "s", label: "sm" },
      { value: "m", label: "md" },
      { value: "l", label: "lg" },
      { value: "xl", label: "airy" },
    ],
    initialSize: "m",
    effects: [
      { value: "none" },
      { value: "specular", label: "specular rim" },
      { value: "tactile", label: "active:scale" },
    ],
    initialEffect: "specular",
    initialLoading: false,
    initialDisabled: false,
    initialError: false,
    showDepressionProbe: true,
  });
}

// ─── Banner Playground ──────────────────────────────────────────────────────

export function useBannerPlayground() {
  return useComponentPlayground({
    variants: [
      { value: "strip" },
      { value: "card" },
      { value: "callout" },
    ],
    initialVariant: "strip",
    tones: [
      { value: "neutral" },
      { value: "info" },
      { value: "success", label: "healthy" },
      { value: "warning", label: "regression" },
      { value: "danger", label: "escalating" },
    ],
    initialTone: "warning",
    initialLoading: false,
    initialDisabled: false,
    initialError: false,
  });
}

// ─── Badge / Pill Playground ────────────────────────────────────────────────

export function useBadgePlayground() {
  return useComponentPlayground({
    variants: [
      { value: "neutral" },
      { value: "info" },
      { value: "healthy", label: "success" },
      { value: "warning" },
      { value: "error", label: "danger" },
      { value: "escalating" },
      { value: "regression" },
      { value: "accent" },
    ],
    initialVariant: "neutral",
    sizes: [
      { value: "compact" },
      { value: "sm" },
      { value: "md" },
      { value: "default" },
    ],
    initialSize: "sm",
    initialLoading: false,
    initialDisabled: false,
    initialError: false,
  });
}

// ─── Input Playground ───────────────────────────────────────────────────────

export function useInputPlayground() {
  return useComponentPlayground({
    sizes: [
      { value: "sm" },
      { value: "md" },
      { value: "lg" },
    ],
    initialSize: "md",
    initialLoading: false,
    initialDisabled: false,
    initialError: false,
  });
}

// ─── Empty State Playground ─────────────────────────────────────────────────

export function useEmptyStatePlayground() {
  return useComponentPlayground({
    variants: [
      { value: "quiet", label: "Quiet Empty" },
      { value: "with-action", label: "With Action" },
      { value: "error", label: "Error State" },
      { value: "loading-spinner", label: "Spinner" },
      { value: "loading-skeleton", label: "Skeleton" },
    ],
    initialVariant: "quiet",
    initialLoading: false,
    initialDisabled: false,
    initialError: false,
  });
}
