import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SheetPreview() {
  return (
    <PreviewBlock id="sheet" title="Sheet" description="side: top · bottom · left · right">
      <PreviewRow label="Sides">
        {(["right","left","top","bottom"] as const).map((side) => (
          <Sheet key={side}><SheetTrigger asChild><Button size="sm" variant="outline">{side}</Button></SheetTrigger>
            <SheetContent side={side}><SheetHeader><SheetTitle>{side} sheet</SheetTitle><SheetDescription>Payload preview</SheetDescription></SheetHeader><SheetFooter><SheetClose asChild><Button size="sm" variant="secondary">Close</Button></SheetClose></SheetFooter></SheetContent>
          </Sheet>
        ))}
      </PreviewRow>
    </PreviewBlock>
  );
}