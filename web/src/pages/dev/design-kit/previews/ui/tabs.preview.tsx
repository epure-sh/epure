import { Tabs, TabsContent, TabsList, TabsTrigger } from "@polar-sh/orbit/Tabs";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function TabsPreview() {
  return (
    <PreviewBlock id="tabs" title="Tabs" description="Polar Orbit Tabs.">
      <PreviewRow label="Basic">
        <Tabs defaultValue="one" className="w-full max-w-md">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="pt-2 text-xs text-fg-muted">
            Panel one
          </TabsContent>
          <TabsContent value="two" className="pt-2 text-xs text-fg-muted">
            Panel two
          </TabsContent>
        </Tabs>
      </PreviewRow>
    </PreviewBlock>
  );
}
