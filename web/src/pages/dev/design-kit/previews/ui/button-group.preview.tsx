import { ButtonGroup } from "@polar-sh/orbit";
import { PreviewBlock, PreviewRow, MatrixCell } from "../../shared";

export default function ButtonGroupPreview() {
  return (
    <PreviewBlock
      id="button-group"
      title="ButtonGroup"
      description="Primary + optional ghost companion. Size is owned by the group."
    >
      <PreviewRow label="Basic · one action">
        <ButtonGroup actions={[{ text: "Continue", onClick: () => undefined }]} />
      </PreviewRow>
      <PreviewRow label="Two actions">
        <ButtonGroup
          actions={[
            { text: "Save", onClick: () => undefined },
            { text: "Cancel", onClick: () => undefined },
          ]}
        />
      </PreviewRow>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["sm", "default", "lg"] as const).map((size) => (
          <MatrixCell key={size} label={size}>
            <ButtonGroup
              size={size}
              actions={[
                { text: "Primary", onClick: () => undefined },
                { text: "Ghost", onClick: () => undefined },
              ]}
            />
          </MatrixCell>
        ))}
      </div>
    </PreviewBlock>
  );
}
