import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow, MatrixCell } from "../../shared";

export default function BoxPreview() {
  return (
    <PreviewBlock
      id="box"
      title="Box"
      description="Layout primitive — typed spacing, color, radius. Prefer Box over bare divs."
    >
      <PreviewRow label="Basic">
        <Box
          padding="l"
          backgroundColor="background-card"
          borderRadius="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Text variant="body">padding=l · background-card</Text>
        </Box>
      </PreviewRow>
      <PreviewRow label="Direction & gap">
        <Box flexDirection="row" columnGap="m" alignItems="center">
          <Box padding="s" backgroundColor="background-secondary" borderRadius="s">
            <Text variant="caption">A</Text>
          </Box>
          <Box padding="s" backgroundColor="background-secondary" borderRadius="s">
            <Text variant="caption">B</Text>
          </Box>
          <Box padding="s" backgroundColor="background-secondary" borderRadius="s">
            <Text variant="caption">C</Text>
          </Box>
        </Box>
      </PreviewRow>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["s", "m", "l", "xl"] as const).map((r) => (
          <MatrixCell key={r} label={`radius ${r}`}>
            <Box
              width={48}
              height={48}
              backgroundColor="background-secondary"
              borderRadius={r}
            />
          </MatrixCell>
        ))}
      </div>
    </PreviewBlock>
  );
}
