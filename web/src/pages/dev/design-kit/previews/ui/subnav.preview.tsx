import { Subnav, SubnavItem } from "@polar-sh/orbit";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SubnavPreview() {
  return (
    <PreviewBlock
      id="subnav"
      title="Subnav"
      description="Secondary in-page navigation."
    >
      <PreviewRow label="Basic">
        <Subnav label="Sections">
          <SubnavItem active>
            <a href="#overview">Overview</a>
          </SubnavItem>
          <SubnavItem>
            <a href="#activity">Activity</a>
          </SubnavItem>
          <SubnavItem>
            <a href="#settings">Settings</a>
          </SubnavItem>
        </Subnav>
      </PreviewRow>
    </PreviewBlock>
  );
}
