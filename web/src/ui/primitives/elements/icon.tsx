// web/src/ui/primitives/elements/icon.tsx
// Curated Phosphor Icon wrapper with explicit named re-exports (preventing discovery waterfalls).

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
  DiscordLogo,
  DotsThree,
  EnvelopeSimple,
  Eye,
  Flame,
  Gear,
  Hash,
  Info,
  Key,
  List,
  MagnifyingGlass,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Radio,
  Rocket,
  ShieldCheck,
  ShieldWarning,
  SlackLogo,
  SlidersHorizontal,
  Sparkle,
  Tag,
  TelegramLogo,
  Terminal,
  Trash,
  Tray,
  TrendDown,
  TrendUp,
  Users,
  Warning,
  WarningCircle,
  WarningOctagon,
  WebhooksLogo,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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
  DiscordLogo,
  DotsThree,
  EnvelopeSimple,
  Eye,
  Flame,
  Gear,
  Hash,
  Info,
  Key,
  List,
  MagnifyingGlass,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Radio,
  Rocket,
  ShieldCheck,
  ShieldWarning,
  SlackLogo,
  SlidersHorizontal,
  Sparkle,
  Tag,
  TelegramLogo,
  Terminal,
  Trash,
  Tray,
  TrendDown,
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
