import { Button } from "@/components/ui/button";
import { startProductTour } from "@/components/kit/product-tour";
import { PreviewBlock } from "../../shared";

export default function ProductTourPreview() {
  return (
    <PreviewBlock
      id="product-tour"
      title="Product tour"
      description="Soft-focus first-login tour (≤8 steps). Gradient vignette — no hard ring."
    >
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          startProductTour({
            steps: [
              {
                element: "[data-design-kit-block='product-tour']",
                popover: {
                  title: "Soft focus",
                  description: "Faded vignette around the target — not a hard cutout.",
                },
              },
            ],
          })
        }
      >
        Start mini tour
      </Button>
    </PreviewBlock>
  );
}