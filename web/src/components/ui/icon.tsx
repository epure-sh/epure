// src/components/ui/icon.tsx
import * as React from "react";
import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowRight,
  ArrowSquareOut,
  Bell,
  CaretDown,
  CaretLeft,
  ChartBar,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  Copy,
  DotsThree,
  EnvelopeSimple,
  Eye,
  Flame,
  Gear,
  Hash,
  Info,
  List,
  MagnifyingGlass,
  Pause,
  PencilSimple,
  Plus,
  Radio,
  ShieldWarning,
  SlidersHorizontal,
  Sparkle,
  Tag,
  Terminal,
  Trash,
  Tray,
  TrendUp,
  Users,
  Warning,
  WarningCircle,
  WarningOctagon,
  WebhooksLogo,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Explicit Phosphor re-exports only.
 * Never `export * from "@phosphor-icons/react"` — with Vite `optimizeDeps.noDiscovery`
 * that barrel fans out to ~4k module requests and leaves `#root` blank until
 * (or unless) the graph finishes.
 */
export {
  Archive,
  ArrowCounterClockwise,
  ArrowRight,
  ArrowSquareOut,
  Bell,
  CaretDown,
  CaretLeft,
  ChartBar,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  Copy,
  DotsThree,
  EnvelopeSimple,
  Eye,
  Flame,
  Gear,
  Hash,
  Info,
  List,
  MagnifyingGlass,
  Pause,
  PencilSimple,
  Plus,
  Radio,
  ShieldWarning,
  SlidersHorizontal,
  Sparkle,
  Tag,
  Terminal,
  Trash,
  Tray,
  TrendUp,
  Users,
  Warning,
  WarningCircle,
  WarningOctagon,
  WebhooksLogo,
  X,
};

export type { PhosphorIcon as IconType, IconWeight };

export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, "size"> {
  icon: PhosphorIcon | React.ComponentType<any>;
  size?: number | string;
  weight?: IconWeight;
  className?: string;
}

export function Icon({
  icon: IconComponent,
  size = 15,
  weight = "regular",
  className,
  ...props
}: IconProps) {
  return (
    <IconComponent
      data-slot="icon"
      size={size}
      weight={weight}
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}
