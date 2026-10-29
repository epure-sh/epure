import {
  PolarCard,
  PolarCardBody,
  PolarCardDescription,
  PolarCardHeader,
  PolarCardTitle,
} from "@/components/kit/polar-card";
import { SectionCard } from "@/components/kit/section-card";
import { UsageMeterCard } from "@/components/kit/usage-meter-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Section, SectionHeader } from "@/ui/section";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function CardPreview() {
  return (
    <PreviewBlock
      id="card"
      title="Card"
      description="Surface cards — section, polar gallery, usage meter."
    >
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
