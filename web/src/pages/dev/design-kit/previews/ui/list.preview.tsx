import { List, ListItem } from "@polar-sh/orbit";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ListPreview() {
  return (
    <PreviewBlock id="list" title="List" description="Stacked rows with selection and size.">
      <PreviewRow label="Basic">
        <List className="w-72">
          <ListItem>Inbox</ListItem>
          <ListItem selected>Selected</ListItem>
          <ListItem>Archived</ListItem>
        </List>
      </PreviewRow>
      <PreviewRow label="Size · small" className="mt-3">
        <List size="small" className="w-72">
          <ListItem size="small">Dense row</ListItem>
          <ListItem size="small" selected>
            Dense selected
          </ListItem>
        </List>
      </PreviewRow>
    </PreviewBlock>
  );
}
