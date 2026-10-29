import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow } from "../../shared";

const VARIANTS = [
  "heading-2xl",
  "heading-xl",
  "heading-l",
  "heading-m",
  "heading-s",
  "heading-xs",
  "heading-xxs",
  "body",
  "title",
  "label",
  "caption",
] as const;

const COLORS = [
  "default",
  "muted",
  "accent",
  "danger",
  "warning",
  "success",
] as const;

export default function TextPreview() {
  return (
    <PreviewBlock
      id="text"
      title="Text"
      description="Typed variants — never invent a type size."
    >
      <PreviewRow label="Variants">
        <div className="flex w-full flex-col gap-2">
          {VARIANTS.map((v) => (
            <Text key={v} variant={v} as="p">
              {v} — The quick brown fox
            </Text>
          ))}
        </div>
      </PreviewRow>
      <PreviewRow label="Color" className="mt-4">
        <div className="flex flex-wrap gap-3">
          {COLORS.map((c) => (
            <Text key={c} variant="body" color={c}>
              {c}
            </Text>
          ))}
        </div>
      </PreviewRow>
      <PreviewRow label="Mono" className="mt-3">
        <Text variant="body" monospace>
          tabular · Geist Mono
        </Text>
      </PreviewRow>
    </PreviewBlock>
  );
}
