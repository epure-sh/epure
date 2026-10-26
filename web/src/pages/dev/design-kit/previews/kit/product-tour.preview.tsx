import { Button } from "@/components/ui/button";
import { startProductTour } from "@/components/kit/product-tour";
import { PreviewBlock } from "../../shared";

export default function ProductTourPreview() {
  return (
    <PreviewBlock id="product-tour" title="Product tour (driver.js)">
      <Button size="sm" variant="outline" onClick={() => startProductTour({ steps: [{ element: "[data-design-kit-block='product-tour']", popover: { title: "Tour", description: "Calm Ledger tokens" } }] })}>Start mini tour</Button>
    </PreviewBlock>
  );
}