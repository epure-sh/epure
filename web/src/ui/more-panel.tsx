import type { ReactNode } from "react";

export interface MorePanelProps {
  children: ReactNode;
}

export function MorePanel({ children }: MorePanelProps) {
  return (
    <div className="epure-more-panel flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
  );
}
