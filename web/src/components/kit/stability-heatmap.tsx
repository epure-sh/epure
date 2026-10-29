import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import {
  ActivityHeatmap,
  type ActivityDay,
} from "@/components/ui/activity-heatmap";

export interface StabilityDay {
  date: string;
  count: number;
}

export interface StabilityHeatmapProps {
  days: StabilityDay[];
  loading?: boolean;
  onDayClick?: (day: StabilityDay) => void;
  selectedDate?: string | null;
  /** Shown in the heatmap summary period phrase. */
  period?: string;
  /** Hide the kit chrome title — parent SectionCard already labels the zone. */
  compact?: boolean;
}

function fillYear(days: StabilityDay[]): ActivityDay[] {
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);

  const filled: ActivityDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    filled.push({ date: iso, count: byDate.get(iso) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return filled;
}

/**
 * GitHub-style relative intensity: bucket against the year's average busy day
 * so quiet and loud years both keep visible texture.
 */
function thresholdsFromAverage(days: ActivityDay[]): [number, number, number] {
  const busy = days.map((day) => day.count).filter((count) => count > 0);
  if (busy.length === 0) {
    return [1, 2, 3];
  }
  const average = busy.reduce((sum, count) => sum + count, 0) / busy.length;
  const t1 = Math.max(1, Math.round(average * 0.5));
  const t2 = Math.max(t1 + 1, Math.round(average));
  const t3 = Math.max(t2 + 1, Math.round(average * 2));
  return [t1, t2, t3];
}

/** 365-day error intensity calendar — Orbit kit chrome over ActivityHeatmap. */
export function StabilityHeatmap({
  days,
  loading = false,
  onDayClick,
  selectedDate = null,
  period = "the last year",
  compact = false,
}: StabilityHeatmapProps) {
  const activity = React.useMemo(() => fillYear(days), [days]);
  const thresholds = React.useMemo(() => thresholdsFromAverage(activity), [activity]);
  const [internalSelected, setInternalSelected] = React.useState<string | null>(
    selectedDate,
  );

  React.useEffect(() => {
    setInternalSelected(selectedDate);
  }, [selectedDate]);

  const cleanStreak = React.useMemo(() => {
    let streak = 0;
    for (let i = activity.length - 1; i >= 0; i -= 1) {
      if (activity[i].count > 0) break;
      streak += 1;
    }
    return streak;
  }, [activity]);

  if (loading) {
    return (
      <Box
        data-slot="stability-heatmap"
        height={148}
        borderRadius="m"
        backgroundColor="background-secondary"
      />
    );
  }

  return (
    <Box data-slot="stability-heatmap" flexDirection="column" rowGap="m" width="100%" minWidth={0}>
      {compact ? null : (
        <Box alignItems="end" justifyContent="between" columnGap="m" flexWrap="wrap" rowGap="s">
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            <Text as="p" variant="caption" color="muted">
              365-day stability
            </Text>
            <Text as="p" variant="caption" color="muted">
              Clean days stay quiet. Spikes warm into the escalating tint.
            </Text>
          </Box>
          <Text as="p" variant="caption" color="muted">
            <Text as="span" variant="caption" color="success">
              {cleanStreak}
            </Text>{" "}
            day clean streak
          </Text>
        </Box>
      )}

      <ActivityHeatmap
        days={activity}
        label="Error activity in the last year"
        period={period}
        unit={{ one: "error", other: "errors" }}
        thresholds={thresholds}
        selectedDate={internalSelected}
        onSelectDate={(date) => {
          setInternalSelected(date);
          const day = activity.find((entry) => entry.date === date) ?? {
            date,
            count: 0,
          };
          onDayClick?.(day);
        }}
        actions={
          compact ? (
            <Text as="span" variant="caption" color="muted">
              <Text as="span" variant="caption" color="success">
                {cleanStreak}
              </Text>{" "}
              day streak
            </Text>
          ) : undefined
        }
      />
    </Box>
  );
}
