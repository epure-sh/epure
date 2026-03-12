import { cn } from "@/lib/cn";
import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** Org Member — not Owner or Admin. */
export function isSharedProjectRole(role: string | null | undefined): boolean {
  return role === "member";
}

export function SharedProjectBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          size="compact"
          title="You don’t own this project"
          className={cn("tracking-ui", className)}
        >
          Shared
        </Badge>
      </TooltipTrigger>
      <TooltipContent>You don’t own this project</TooltipContent>
    </Tooltip>
  );
}
