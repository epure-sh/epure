import { Button } from "@polar-sh/orbit/Button";
import { Settings2 } from "@polar-sh/orbit/icons";
import {
  ComponentPlaygroundControls,
  useInteractiveButtonPlayground,
} from "../../component-playground-controls";
import { PreviewBlock, PreviewRow, MatrixCell } from "../../shared";

const variants = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;
const sizes = ["sm", "default", "lg", "icon"] as const;

/** Polar Orbit Button — not the Epure façade. */
export default function ButtonPreview() {
  const playground = useInteractiveButtonPlayground();

  return (
    <PreviewBlock
      id="button"
      title="Button"
      description="Polar Orbit Button — variants, sizes, loading, interactive controls."
    >
      <ComponentPlaygroundControls
        axes={playground.axes}
        flags={playground.flags}
        showDepressionProbe
      />
      <PreviewRow label="Live">
        <Button
          variant={playground.error ? "destructive" : (playground.variant as (typeof variants)[number])}
          size={playground.size as "sm" | "default" | "lg"}
          loading={playground.loading}
          disabled={playground.disabled}
        >
          {playground.error ? "Error State" : playground.loading ? "Working…" : "Interactive"}
        </Button>
      </PreviewRow>
      <PreviewRow label="Variant">
        {variants.map((v) => (
          <Button key={v} variant={v} size="sm">
            {v}
          </Button>
        ))}
      </PreviewRow>
      <PreviewRow label="State">
        <Button variant="secondary" size="sm" loading>
          Loading
        </Button>
        <Button variant="secondary" size="sm" disabled>
          Disabled
        </Button>
      </PreviewRow>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {sizes.map((s) => (
          <MatrixCell key={s} label={s}>
            {s === "icon" ? (
              <Button variant="outline" size="icon" title={s}>
                <Settings2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="secondary" size={s}>
                {s}
              </Button>
            )}
          </MatrixCell>
        ))}
      </div>
    </PreviewBlock>
  );
}
