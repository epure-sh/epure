import { Box } from "@polar-sh/orbit/Box";
import { Grid } from "@polar-sh/orbit/Grid";
import { Text } from "@polar-sh/orbit/Text";
import { Checkbox } from "@/components/ui/checkbox";

/** Embedded History feed — checkbox · title stack · fired time. */
export const ALERT_ROW_TEMPLATE = "16px minmax(0, 1fr) auto";

/** Notification feed cards — checkbox · kind icon · title · fired time. */
export const ALERT_FEED_CARD_TEMPLATE = "16px 1.25rem minmax(0, 1fr) auto";

/** @deprecated Prefer ALERT_ROW_TEMPLATE with Orbit Grid. */
export const ALERT_ROW_GRID = "grid-cols-[16px_minmax(0,1fr)_auto]";

/** @deprecated Prefer ALERT_FEED_CARD_TEMPLATE with Orbit Grid. */
export const ALERT_FEED_CARD_ROW_GRID = "grid-cols-[16px_1.25rem_minmax(0,1fr)_auto]";

/** Shared horizontal inset — keep in sync with alert rows (Tailwind until rows migrate). */
export const ALERT_LIST_INSET_CLASS = "gap-x-3 px-4 sm:gap-x-3.5";

export interface AlertListColumnHeaderProps {
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  onToggleSelectAll?: () => void;
  selectionActive?: boolean;
}

/**
 * Column labels — Orbit Text roles + Grid (Polar authoring).
 * Alert = primary `title`; Fired = muted mono `caption`.
 */
export function AlertListColumnHeader({
  selectAllChecked = false,
  selectAllIndeterminate = false,
  onToggleSelectAll,
  selectionActive = false,
}: AlertListColumnHeaderProps) {
  return (
    <Grid
      as="div"
      data-slot="alert-list-column-header"
      templateColumns={ALERT_ROW_TEMPLATE}
      alignItems="center"
      width="100%"
      height={32}
      columnGap="m"
      paddingHorizontal="l"
      backgroundColor="background-secondary"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      position="sticky"
      top={0}
      zIndex={10}
      userSelect="none"
      aria-hidden
    >
      <Box alignItems="center" justifyContent="center" width={16} height={16} flexShrink={0}>
        {onToggleSelectAll ? (
          <Checkbox
            checked={selectAllIndeterminate ? "indeterminate" : selectAllChecked}
            aria-label="Select all alerts"
            title="Select all"
            onCheckedChange={() => onToggleSelectAll()}
            // Opacity affordance is product glue on Checkbox (not Box/Text)
            className={
              selectionActive
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            }
          />
        ) : null}
      </Box>
      <Box minWidth={0} overflow="hidden">
        <Text as="span" variant="title">
          Alert
        </Text>
      </Box>
      <Text as="span" variant="caption" color="muted" monospace tabularNums>
        Fired
      </Text>
    </Grid>
  );
}
