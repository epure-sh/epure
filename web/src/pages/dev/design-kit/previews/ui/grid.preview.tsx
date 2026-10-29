import { Box } from "@polar-sh/orbit/Box";
import { Grid } from "@polar-sh/orbit/Grid";
import { GridItem } from "@polar-sh/orbit/GridItem";
import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow } from "../../shared";

function Cell({ label }: { label: string }) {
  return (
    <Box
      padding="m"
      backgroundColor="background-secondary"
      borderRadius="s"
      alignItems="center"
      justifyContent="center"
    >
      <Text variant="caption" monospace>
        {label}
      </Text>
    </Box>
  );
}

export default function GridPreview() {
  return (
    <PreviewBlock id="grid" title="Grid" description="CSS grid with token gaps.">
      <PreviewRow label="Basic · 3 columns">
        <Grid templateColumns="repeat(3, 1fr)" gap="m" width="100%">
          <Cell label="1" />
          <Cell label="2" />
          <Cell label="3" />
        </Grid>
      </PreviewRow>
      <PreviewRow label="Span" className="mt-3 w-full">
        <Grid templateColumns="repeat(4, 1fr)" gap="s" width="100%">
          <GridItem colSpan={2}>
            <Cell label="span 2" />
          </GridItem>
          <Cell label="3" />
          <Cell label="4" />
        </Grid>
      </PreviewRow>
    </PreviewBlock>
  );
}
