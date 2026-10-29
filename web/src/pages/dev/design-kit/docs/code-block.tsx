import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Button } from "@polar-sh/orbit/Button";
import { Text } from "@polar-sh/orbit/Text";

/** Plain TSX code strip under an Example (Orbit docs pattern; no MDX). */
export function DocsCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const lines = code.replace(/\n$/, "").split("\n");

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box
      position="relative"
      backgroundColor="background-secondary"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      overflow="hidden"
      width="100%"
    >
      <Box position="absolute" top={8} right={8} zIndex={1}>
        <Button variant="ghost" size="sm" type="button" onClick={copy} aria-label="Copy code">
          {copied ? "Copied" : "Copy"}
        </Button>
      </Box>
      <Box
        flexDirection="column"
        padding="l"
        paddingRight="5xl"
        overflowX="auto"
        width="100%"
        rowGap="none"
      >
        {lines.map((line, index) => (
          <Text key={index} as="span" monospace color="inherit">
            {line.length > 0 ? line : "\u00A0"}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
