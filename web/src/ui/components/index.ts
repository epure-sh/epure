// web/src/ui/components/index.ts
// Tier 2: Composite Variant-Driven Components
// Consolidates similar UI components into variant-driven composite components,
// providing complete backward-compatible exports and full type safety.

// ---------------------------------------------------------------------------
// 1. Core Consolidation Clusters
// ---------------------------------------------------------------------------

// Cluster 1: Unified Copy & Action Button
export {
  CopyButton,
  ApplyWithAiButton,
  InlineCopyButton,
  type CopyButtonProps,
  type ApplyWithAiButtonProps,
  type CopyButtonVariant,
  type CopyButtonProminence,
  type CopyButtonSize,
} from "./copy-button";
export {
  AgentVendorAvatars,
  type AgentVendorAvatarsProps,
} from "./agent-vendor-avatars";

// Cluster 2: Unified Banners & Context Strips
export {
  Banner,
  FairUseBanner,
  RegressionStrip,
  IssuesContextStrip,
  IssuesHomeHint,
  SetupWaitingBanner,
  TestDataBanner,
  type BannerProps,
  type BannerTone,
  type BannerVariant,
  type FairUseBannerProps,
  type RegressionStripProps,
  type IssuesContextStripProps,
  type IssuesHomeHintProps,
  type SetupWaitingBannerProps,
  type TestDataBannerProps,
} from "./banner";

// Cluster 3: Unified Code Block & Frame
export {
  CodeBlock,
  SourceCodeBlock,
  CodeFrame,
  type CodeBlockProps,
  type SourceCodeBlockProps,
  type CodeFrameProps,
  type CodeLine,
  type SourceCodeLine,
  type CodeLineItem,
  type CodeBlockVariant,
  type CodeBlockDensity,
  type CodeBlockFaultTone,
} from "./code-block";

// Cluster 4: Unified Card System
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardBody,
  CardFooter,
  CardAction,
  PolarCard,
  PolarCardHeader,
  PolarCardTitle,
  PolarCardDescription,
  PolarCardBody,
  PolarCardFooter,
  PolarCardOpenHint,
  SectionCard,
  type CardProps,
  type CardVariant,
  type CardPadding,
  type PolarCardProps,
  type PolarCardVariant,
  type PolarCardPadding,
  type SectionCardProps,
} from "./card";

// Cluster 5: Unified AI Copilot Diagnostic Card
export {
  AiCopilotCard,
  AskAgentCard,
  IssueAiCopilotCard,
  extractCulprit,
  generateAiDiagnosis,
  type AiCopilotCardProps,
  type AskAgentCardProps,
  type IssueAiCopilotCardProps,
  type AiCopilotCardVariant,
} from "./ai-copilot-card";

// Cluster 6: Unified Empty & Error State
export {
  EmptyState,
  Empty,
  ErrorState,
  NotFoundState,
  ForbiddenState,
  type EmptyStateProps,
  type EmptyProps,
  type ErrorStateProps,
  type EmptyStateStatus,
  type EmptyStateVariant,
} from "./empty-state";

// ---------------------------------------------------------------------------
// 2. Tier 2 Composite Components
// ---------------------------------------------------------------------------

export {
  ActionButton,
  type ActionButtonProps,
} from "./action-button";

export {
  FilterChip,
  type FilterChipProps,
} from "./filter-chip";

export {
  SharedProjectBadge,
  isSharedProjectRole,
} from "./shared-project-badge";

export {
  IssuePriorityIcon,
  IssuePriorityBadge,
  resolveIssuePriority,
  getIssuePriorityLabel,
  type IssuePriority,
  type IssuePriorityIconProps,
  type IssuePriorityBadgeProps,
} from "./issue-priority";

export {
  StepIndicator,
  type StepIndicatorItem,
  type StepIndicatorProps,
} from "./step-indicator";

export {
  Sparkline,
  inferTrendStatus,
  fillSparklineWindow,
  downsampleSparkValues,
  sparklineBarCountForWindow,
  SPARKLINE_BAR_COUNT,
  type SparklinePoint,
  type SparklineProps,
  type TrendStatus,
} from "./sparkline";

export {
  StatBar,
  type StatBarItem,
  type StatBarProps,
} from "./stat-bar";

export {
  ApiKeyField,
  type ApiKeyFieldProps,
} from "./api-key-field";

export {
  CopyDsnBlock,
  type CopyDsnBlockProps,
} from "./copy-dsn-block";

export {
  CopyCurlBlock,
  buildCurlFromRequest,
  type CopyCurlBlockProps,
} from "./copy-curl-block";

export {
  SdkSnippetBlock,
  type SdkSnippetBlockProps,
} from "./sdk-snippet-block";

export {
  EventHttpRequest,
  parseEventHttpRequest,
  buildCurl,
  type ParsedHttpRequest,
} from "./event-http-request";

export {
  OccurrencePicker,
  type OccurrencePickerProps,
} from "./occurrence-picker";

export {
  SetupPlatformMark,
  type SetupPlatformMarkProps,
} from "./setup-platform-mark";

export {
  SetupDocsLink,
  SetupStepSection,
} from "./setup-docs-link";

export {
  KeyboardHintsFooter,
} from "./keyboard-hints-footer";

export {
  ListRow,
  type ListRowProps,
  type ListRowVariant,
  type ListRowAccent,
} from "./list-row";

export {
  Section,
  SectionHeader,
  type SectionProps,
  type SectionHeaderProps,
  type SectionMarkerTone,
} from "./section";

export {
  ToastProvider,
  useToast,
  type ToastApi,
  type ToastContextValue,
} from "./toast-provider";

export {
  Toast,
  type ToastProps,
} from "./toast";

export {
  Field,
  type FieldProps,
} from "./field";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandShortcut,
  type CommandDialogProps,
} from "./command";

