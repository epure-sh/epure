import { CodeFrame } from "@/components/kit/code-frame";
import { CodeBlock } from "@/ui/components";
import { CopyDsnBlock } from "@/ui/components";
import { SdkSnippetBlock } from "@/ui/components";
import { SourceCodeBlock } from "@/ui/components";
import { PreviewBlock, MatrixCell } from "../../shared";

const DEMO_DSN = "https://public@localhost:8080/550e8400-e29b-41d4-a716-446655440000";

export default function CodePreview() {
  return (
    <PreviewBlock
      id="code"
      title="Code"
      description="Frames, blocks, SDK snippets, DSN copy."
    >
      <div className="grid grid-cols-1 gap-3">
        <MatrixCell label="Code frame">
          <CodeFrame language="typescript" code={"const x = 1\nconsole.log(x)"} />
        </MatrixCell>
        <MatrixCell label="Code block">
          <CodeBlock
            lines={[
              { number: 1, text: "function main() {" },
              { number: 2, text: "  throw new Error('boom')", fault: true },
              { number: 3, text: "}" },
            ]}
          />
        </MatrixCell>
        <MatrixCell label="Source">
          <SourceCodeBlock
            filename="app.ts"
            lines={[
              { number: 1, text: "export function main() {" },
              { number: 2, text: "  return 0" },
              { number: 3, text: "}" },
            ]}
          />
        </MatrixCell>
        <MatrixCell label="SDK snippet">
          <SdkSnippetBlock dsn={DEMO_DSN} title="Install" initOnly />
        </MatrixCell>
        <MatrixCell label="DSN">
          <CopyDsnBlock dsn={DEMO_DSN} />
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
