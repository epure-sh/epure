import { Input } from "@/components/ui/input";
import { Field } from "@/ui/field";
import { Kbd } from "@/ui/kbd";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function FieldPreview() {
  return (
    <PreviewBlock
      id="field"
      title="Field"
      description="Labeled form field · hint · error · keyboard hints."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MatrixCell label="Basic">
          <Field label="Webhook URL" hint="HTTPS only">
            <Input placeholder="https://..." />
          </Field>
        </MatrixCell>
        <MatrixCell label="Error">
          <Field label="Email" error="Required">
            <Input placeholder="you@acme.com" />
          </Field>
        </MatrixCell>
      </div>
      <PreviewRow label="Kbd" className="mt-3">
        <Kbd keys="⌘K" />
        <Kbd keys="J" />
        <Kbd keys="⇧" />
      </PreviewRow>
    </PreviewBlock>
  );
}
