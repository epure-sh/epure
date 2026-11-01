import { ActionButton } from "@/ui/components";
import {
  ComponentPlaygroundControls,
  useComponentPlayground,
} from "../../component-playground-controls";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ActionButtonPreview() {
  const playground = useComponentPlayground({
    variants: [
      { value: "primary" },
      { value: "secondary" },
      { value: "outline" },
      { value: "ghost" },
      { value: "danger" },
    ],
    initialVariant: "secondary",
    sizes: [
      { value: "xs" },
      { value: "sm" },
      { value: "md" },
      { value: "lg" },
    ],
    initialSize: "sm",
    initialLoading: false,
    initialDisabled: false,
    initialError: false,
    showDepressionProbe: true,
  });

  const activeVariant = playground.error ? "danger" : playground.variant;

  return (
    <PreviewBlock
      id="action-button"
      title="ActionButton"
      description="Button with disabled-tooltip affordance and mechanical depression probe — `@/ui/components`."
      controls={
        <ComponentPlaygroundControls
          axes={playground.axes}
          flags={playground.flags}
          showDepressionProbe={playground.showDepressionProbe}
        />
      }
    >
      <PreviewRow label="Live Interactive ActionButton">
        <ActionButton
          variant={activeVariant as "primary" | "secondary" | "outline" | "ghost" | "danger"}
          size={playground.size as "xs" | "sm" | "md" | "lg"}
          loading={playground.loading}
          disabled={playground.disabled}
          tooltip={playground.disabled ? "Requires triage administrator privileges" : undefined}
        >
          {playground.error
            ? "Escalate Issue"
            : playground.loading
              ? "Applying…"
              : "Execute Action"}
        </ActionButton>
      </PreviewRow>
      <PreviewRow label="Default" className="mt-3">
        <ActionButton size="sm" variant="secondary">
          Resolve
        </ActionButton>
        <ActionButton size="sm" variant="outline">
          Snooze
        </ActionButton>
      </PreviewRow>
      <PreviewRow label="Disabled + tooltip" className="mt-3">
        <ActionButton size="sm" variant="secondary" disabled tooltip="Needs permission">
          Assign
        </ActionButton>
      </PreviewRow>
    </PreviewBlock>
  );
}
