import { Alert, type AlertVariant } from "@polar-sh/orbit/Alert";
import { PreviewBlock, MatrixCell } from "../../shared";

const VARIANTS: AlertVariant[] = ["info", "warning", "danger", "success"];

export default function AlertPreview() {
  return (
    <PreviewBlock
      id="alert"
      title="Alert"
      description="Polar Orbit Alert — severity via variant."
    >
      <div className="grid grid-cols-1 gap-3">
        {VARIANTS.map((variant) => (
          <MatrixCell key={variant} label={variant}>
            <Alert
              variant={variant}
              title={variant}
              description="Supporting copy for this severity."
            />
          </MatrixCell>
        ))}
        <MatrixCell label="loading">
          <Alert variant="info" title="Working" description="Still resolving…" loading />
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
