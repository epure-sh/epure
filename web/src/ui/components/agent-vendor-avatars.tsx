// Stacked real Claude · ChatGPT · Cursor marks for agent CTAs.
import { cn } from "@/lib/cn";

const VENDORS = [
  {
    id: "claude",
    label: "Claude",
    src: "/vendors/claude.svg",
    tint: "bg-[#D97757]",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    src: "/vendors/chatgpt.svg",
    tint: "bg-[#10A37F]",
  },
  {
    id: "cursor",
    label: "Cursor",
    src: "/vendors/cursor.svg",
    tint: "bg-fg-primary",
  },
] as const;

export interface AgentVendorAvatarsProps {
  className?: string;
  /** Avatar diameter in px (default 18). */
  size?: number;
}

/** Official vendor marks, tightly overlapped. */
export function AgentVendorAvatars({ className, size = 18 }: AgentVendorAvatarsProps) {
  const overlap = Math.max(4, Math.round(size * 0.35));
  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      title="Claude, ChatGPT, Cursor"
      aria-hidden
    >
      {VENDORS.map((vendor, index) => (
        <span
          key={vendor.id}
          className={cn(
            "relative inline-flex items-center justify-center rounded-full ring-1 ring-surface-1",
            vendor.tint,
          )}
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -overlap,
            zIndex: VENDORS.length - index,
          }}
        >
          <img
            src={vendor.src}
            alt=""
            className="size-[62%] object-contain brightness-0 invert"
            draggable={false}
          />
        </span>
      ))}
    </span>
  );
}
