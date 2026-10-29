import { Button } from "@polar-sh/orbit/Button";
import { Settings2 } from "@polar-sh/orbit/icons";
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
  return (
    <PreviewBlock
      id="button"
      title="Button"
      description="Polar Orbit Button — variants, sizes, loading."
    >
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
