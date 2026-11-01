import {
  PolarCard,
  PolarCardBody,
  PolarCardDescription,
  PolarCardHeader,
  PolarCardTitle,
} from "@/components/kit/polar-card";
import { SectionCard } from "@/components/kit/section-card";
import { UsageMeterCard } from "@/components/kit/usage-meter-card";
import { Card, CardContent, CardHeader, CardTitle, type CardVariant, type CardPadding } from "@/ui/components";
import { Section, SectionHeader } from "@/ui/components";
import { cn } from "@/lib/utils";
import {
  ComponentPlaygroundControls,
  useCardPlayground,
} from "../../component-playground-controls";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function CardPreview() {
  const playground = useCardPlayground();

  return (
    <PreviewBlock
      id="card"
      title="Card"
      description="Surface cards — section, polar gallery, usage meter with interactive playground."
      controls={
        <ComponentPlaygroundControls
          axes={playground.axes}
          flags={playground.flags}
          showDepressionProbe={playground.showDepressionProbe}
        />
      }
    >
      <div className="mb-4">
        <MatrixCell
          label={`Live Interactive Card · ${playground.variant} · pad(${playground.size}) · ${playground.effect}`}
        >
          <Card
            variant={playground.variant as CardVariant}
            padding={playground.size as CardPadding}
            danger={playground.error}
            className={cn(
              playground.effect === "specular" && "shadow-specular border-border/80",
              playground.effect === "tactile" && "btn-tactile cursor-pointer active:scale-[0.98]",
              playground.disabled && "opacity-50 pointer-events-none",
            )}
            title={playground.error ? "Critical Alert Card" : "Interactive Card"}
            description={
              playground.loading
                ? "Updating card metrics…"
                : "Interactive live card preview configured via ComponentPlaygroundControls."
            }
          >
            <div className="text-xs text-fg-muted">
              Live telemetry surface · padding tier:{" "}
              <span className="font-mono text-fg-primary">{playground.size}</span>
            </div>
          </Card>
        </MatrixCell>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MatrixCell label="Card">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-fg-muted">Body content</CardContent>
          </Card>
        </MatrixCell>
        <MatrixCell label="Section · band">
          <Section variant="band">
            <SectionHeader title="Section" description="Grouped surface" />
            <p className="text-xs text-fg-muted">Children</p>
          </Section>
        </MatrixCell>
        <MatrixCell label="Section card">
          <SectionCard title="Section card" description="Kit chrome">
            <p className="text-xs text-fg-muted">Body</p>
          </SectionCard>
        </MatrixCell>
        <MatrixCell label="Polar card">
          <PolarCard variant="interactive">
            <PolarCardHeader>
              <PolarCardTitle>Polar</PolarCardTitle>
              <PolarCardDescription>Gallery card</PolarCardDescription>
            </PolarCardHeader>
            <PolarCardBody>
              <p className="text-xs text-fg-muted">Orbit Box chrome</p>
            </PolarCardBody>
          </PolarCard>
        </MatrixCell>
        <MatrixCell label="Usage meter · healthy">
          <UsageMeterCard used={42} limit={100} label="Events" />
        </MatrixCell>
        <MatrixCell label="Usage meter · near limit">
          <UsageMeterCard used={90} limit={100} label="Events" />
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
