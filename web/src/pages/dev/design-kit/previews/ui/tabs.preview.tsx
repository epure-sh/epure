import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function TabsPreview() {
  return (
    <PreviewBlock
      id="tabs"
      title="Tabs"
      description="Orbit Tabs with Epure variants. Folder = rectangular bookmark chrome."
    >
      <PreviewRow label="Default">
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

      <PreviewRow label="Line">
        <Tabs variant="line" defaultValue="one" className="w-full max-w-md">
          <TabsList>
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Activity</TabsTrigger>
            <TabsTrigger value="three">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="pt-2 text-xs text-fg-muted">
            Line — underline active.
          </TabsContent>
          <TabsContent value="two" className="pt-2 text-xs text-fg-muted">
            Activity panel
          </TabsContent>
          <TabsContent value="three" className="pt-2 text-xs text-fg-muted">
            Settings panel
          </TabsContent>
        </Tabs>
      </PreviewRow>

      <PreviewRow label="Folder (bookmark)">
        <div className="w-full max-w-md overflow-hidden rounded-md border border-border-subtle bg-surface-1">
          <Tabs variant="folder" defaultValue="one" className="w-full">
            <TabsList className="px-3 pt-2">
              <TabsTrigger value="one">Context</TabsTrigger>
              <TabsTrigger value="two">Stack trace</TabsTrigger>
              <TabsTrigger value="three">Breadcrumbs</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="mt-0 p-3 text-xs text-fg-muted">
              Rectangular tabs with rounded top corners — active merges into the panel.
            </TabsContent>
            <TabsContent value="two" className="mt-0 p-3 text-xs text-fg-muted">
              Stack panel
            </TabsContent>
            <TabsContent value="three" className="mt-0 p-3 text-xs text-fg-muted">
              Breadcrumbs panel
            </TabsContent>
          </Tabs>
        </div>
      </PreviewRow>
    </PreviewBlock>
  );
}
