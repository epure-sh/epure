import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ModalPreview() {
  const [open, setOpen] = React.useState(false);
  return (
    <PreviewBlock
      id="modal"
      title="Modal"
      description="Orbit Modal — prefer for new overlays (`isShown` / `hide` / `modalContent`)"
    >
      <PreviewRow label="Orbit Modal">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Open
        </Button>
        <Modal
          title="Confirm"
          isShown={open}
          hide={() => setOpen(false)}
          modalContent={
            <Box padding="l" flexDirection="column" rowGap="m">
              <Text color="muted" variant="caption">
                Orbit Modal content slot.
              </Text>
              <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </Box>
          }
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
