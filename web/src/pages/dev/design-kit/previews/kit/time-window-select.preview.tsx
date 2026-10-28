import { useState } from "react";
import { TimeWindowSelect } from "@/components/kit/time-window-select";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-window";
import { PreviewBlock } from "../../shared";

export default function TimeWindowSelectPreview() {
  const [val, setVal] = useState("24h");
  return (
    <PreviewBlock id="time-window-select" title="TimeWindowSelect">
      <div className="flex items-center gap-3">
        <TimeWindowSelect value={val} options={TIME_WINDOW_OPTIONS} onValueChange={setVal} />
      </div>
    </PreviewBlock>
  );
}
