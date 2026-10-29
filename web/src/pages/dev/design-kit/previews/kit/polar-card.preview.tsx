import {
  PolarCard,
  PolarCardBody,
  PolarCardDescription,
  PolarCardFooter,
  PolarCardHeader,
  PolarCardTitle,
} from "@/components/kit/polar-card";
import { Button } from "@/components/ui/button";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function PolarCardPreview() {
  return (
    <PreviewBlock
      id="polar-card"
      title="PolarCard"
      description="Gallery / metric / plan tiles — soft border, xl radius, shadow lift"
    >
      <PreviewRow label="Static">
        <PolarCard padding="l">
          <PolarCardBody rowGap="xs">
            <PolarCardTitle>12</PolarCardTitle>
            <PolarCardDescription>Active workspace members</PolarCardDescription>
          </PolarCardBody>
        </PolarCard>
      </PreviewRow>
      <PreviewRow label="Interactive">
        <PolarCard interactive padding="l">
          <PolarCardHeader>
            <PolarCardTitle>Acme API</PolarCardTitle>
          </PolarCardHeader>
          <PolarCardDescription>Hover for lift + shadow</PolarCardDescription>
          <PolarCardFooter>
            <Button size="sm" variant="secondary">
              Open
            </Button>
          </PolarCardFooter>
        </PolarCard>
      </PreviewRow>
      <PreviewRow label="Selected">
        <PolarCard selected padding="l">
          <PolarCardTitle>Current plan</PolarCardTitle>
          <PolarCardDescription>Selected wash</PolarCardDescription>
        </PolarCard>
      </PreviewRow>
    </PreviewBlock>
  );
}
