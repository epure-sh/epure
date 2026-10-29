import { Button } from "@/components/ui/button";
import { Gear, Terminal } from "@/components/ui/icon";
import { PreviewBlock, PreviewRow, MatrixCell } from "../../shared";

const variants = ["primary","secondary","outline","ghost","danger","signal","link"] as const;
const sizes = ["xs","sm","md","default","toolbar","lg","icon","icon-xs"] as const;

export default function ButtonPreview() {
  return (
    <PreviewBlock
      id="button"
      title="Button"
      description="Orbit Button · Epure variants (signal / filter*) · hotkey · loading"
    >
      <PreviewRow label="Variants (sm)">
        {variants.map((v) => (
          <Button key={v} variant={v} size="sm">{v}</Button>
        ))}
      </PreviewRow>
      <PreviewRow label="States">
        <Button variant="secondary" size="sm" hotkey="⌘K">Hotkey</Button>
        <Button variant="secondary" size="sm" loading>Loading</Button>
        <Button variant="secondary" size="sm" disabled>Disabled</Button>
      </PreviewRow>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {sizes.map((s) => (
          <MatrixCell key={s} label={s}>
            {s.startsWith("icon") ? (
              <Button variant="outline" size={s} title={s}><Gear weight="bold" /></Button>
            ) : (
              <Button variant="secondary" size={s}>{s}</Button>
            )}
          </MatrixCell>
        ))}
      </div>
      <PreviewRow label="Icon slot" className="mt-3">
        <Button variant="outline" size="sm"><Terminal className="size-3.5" /> With icon</Button>
      </PreviewRow>
    </PreviewBlock>
  );
}
