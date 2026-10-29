// src/components/kit/usage-meter-card.tsx — Phase 4: Orbit Box/Text chrome
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PolarCard, PolarCardHeader } from "@/components/kit/polar-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface UsageMeterCardProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  warningThreshold?: number; // 0..1 default 0.8
  criticalThreshold?: number; // 0..1 default 0.95
}

export function UsageMeterCard({
  label,
  used,
  limit,
  unit = "events",
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
}: UsageMeterCardProps) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  const percent = Math.round(ratio * 100);

  let status: "healthy" | "regression" | "escalating" = "healthy";
  let statusText = "Normal";

  if (ratio >= criticalThreshold) {
    status = "escalating";
    statusText = "Exceeded";
  } else if (ratio >= warningThreshold) {
    status = "regression";
    statusText = "Near Limit";
  }

  const fillClass =
    status === "escalating"
      ? "bg-red-500"
      : status === "regression"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <PolarCard padding="l">
      <Box flexDirection="column" rowGap="m" width="100%">
        <PolarCardHeader>
          <Text as="span" variant="label">
            {label}
          </Text>
          <Badge variant={status} size="sm">
            {statusText}
          </Badge>
        </PolarCardHeader>

        <Box alignItems="baseline" justifyContent="between" width="100%" columnGap="s">
          <Box alignItems="baseline" columnGap="xs">
            <Text as="span" variant="caption" monospace tabularNums>
              {used.toLocaleString()}
            </Text>
            <Text as="span" variant="caption" color="muted" monospace>
              / {limit.toLocaleString()} {unit}
            </Text>
          </Box>
          <Text as="span" variant="caption" color="muted" monospace tabularNums>
            {percent}%
          </Text>
        </Box>

        <Progress value={percent} indicatorClassName={fillClass} />
      </Box>
    </PolarCard>
  );
}
