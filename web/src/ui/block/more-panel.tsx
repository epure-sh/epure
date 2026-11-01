// web/src/ui/block/more-panel.tsx
// Tier 3 Block: More Panel polymorphic container

import type { ReactNode } from "react";
import { Box } from "../primitives/layout/box";

export interface MorePanelProps {
  children: ReactNode;
}

export function MorePanel({ children }: MorePanelProps) {
  return (
    <div data-slot="more-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Box minHeight={0} flexGrow={1} flexDirection="column" overflow="hidden">
        {children}
      </Box>
    </div>
  );
}
