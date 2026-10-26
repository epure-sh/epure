import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreviewBlock, PreviewRow } from "../../shared";

function TabSet({ variant }: { variant?: "default" | "line" | "folder" }) {
  return (
    <Tabs defaultValue="one" variant={variant} className="w-full max-w-md">
      <TabsList variant={variant}><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList>
      <TabsContent value="one" className="pt-2 text-xs text-fg-muted">Panel one ({variant ?? "default"})</TabsContent>
      <TabsContent value="two" className="pt-2 text-xs text-fg-muted">Panel two</TabsContent>
    </Tabs>
  );
}

export default function TabsPreview() {
  return (
    <PreviewBlock id="tabs" title="Tabs" description="default · line · folder">
      <PreviewRow label="Variants">
        <TabSet /><TabSet variant="line" /><TabSet variant="folder" />
      </PreviewRow>
    </PreviewBlock>
  );
}