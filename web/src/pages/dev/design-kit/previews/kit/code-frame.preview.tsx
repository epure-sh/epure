import { CodeFrame } from "@/components/kit/code-frame";
import { PreviewBlock } from "../../shared";
export default function CodeFramePreview() {
  return (
    <PreviewBlock id="code-frame" title="CodeFrame"><CodeFrame filename="lib.rs" language="typescript" code={"export fn ingest() {\n  return ok;\n}"} highlightLine={2} /></PreviewBlock>
  );
}