import { ListGroup } from "@polar-sh/orbit";
import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ListGroupPreview() {
  return (
    <PreviewBlock
      id="list-group"
      title="ListGroup"
      description="Ringed group of stacked items."
    >
      <PreviewRow label="Basic">
        <ListGroup>
          <ListGroup.Item>
            <Text variant="body">First item</Text>
          </ListGroup.Item>
          <ListGroup.Item>
            <Text variant="body">Second item</Text>
          </ListGroup.Item>
          <ListGroup.Item>
            <Text variant="body">Third item</Text>
          </ListGroup.Item>
        </ListGroup>
      </PreviewRow>
    </PreviewBlock>
  );
}
