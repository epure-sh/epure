import type { ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";

export interface MorePanelProps {
  children: ReactNode;
}

export function MorePanel({ children }: MorePanelProps) {
  return (
    <Box minHeight={0} flexGrow={1} flexDirection="column" overflow="hidden">{children}</Box>
  );
}
