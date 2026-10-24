// src/pages/dev/design-system-playground.tsx
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster, toast } from "@/components/ui/sonner";

import { PageShell } from "@/components/kit/page-shell";
import { SectionCard } from "@/components/kit/section-card";
import { CommandBar } from "@/components/kit/command-bar";
import { FilterBar } from "@/components/kit/filter-bar";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { UsageMeterCard } from "@/components/kit/usage-meter-card";
import { EmptyState } from "@/components/kit/empty-state";
import { DataTable } from "@/components/kit/data-table";
import { CodeFrame } from "@/components/kit/code-frame";
import { startProductTour } from "@/components/kit/product-tour";

import {
  Sparkle,
  Terminal,
  Gear,
  ShieldWarning,
  MagnifyingGlass,
  CheckCircle,
  Clock,
  ArrowRight,
  Flame,
} from "@/components/ui/icon";

const mockTelemetry = [
  { time: "12:00", value: 12 },
  { time: "12:10", value: 45 },
  { time: "12:20", value: 30 },
  { time: "12:30", value: 95 },
  { time: "12:40", value: 140 },
  { time: "12:50", value: 80 },
  { time: "13:00", value: 120 },
];

const mockColumns = [
  { accessorKey: "id", header: "Service ID", size: 110 },
  { accessorKey: "name", header: "Cluster Service", size: 180 },
  { accessorKey: "status", header: "Status", size: 120 },
  { accessorKey: "p99", header: "Latency (p99)", size: 120 },
];

const mockTableRows = [
  { id: "srv-01", name: "auth-gateway", status: "healthy", p99: "14ms" },
  { id: "srv-02", name: "ingest-pipeline", status: "escalating", p99: "310ms" },
  { id: "srv-03", name: "demangle-worker", status: "healthy", p99: "28ms" },
  { id: "srv-04", name: "alert-dispatcher", status: "regression", p99: "95ms" },
  { id: "srv-05", name: "storage-indexer", status: "healthy", p99: "42ms" },
];

const sampleCodeSnippet = `export async function handleIngest(envelope: Envelope) {
  const event = extractEvent(envelope);
  if (!event) throw new Error("Missing event payload");
  return await processEvent(event);
}`;

export function DesignSystemPlayground() {
  const [activeTab, setActiveTab] = React.useState("primitives");
  const [checkbox1, setCheckbox1] = React.useState(false);
  const [checkbox2, setCheckbox2] = React.useState(true);
  const [filterKey, setFilterKey] = React.useState("all");
  const [rowSelected, setRowSelected] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <PageShell
      title="Design System & Micro-Physics Playground"
      description="/dev/ds — 4-State Stress-Testing, Token Locks & Zero-Drift Façade"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              startProductTour({
                steps: [
                  {
                    element: "[data-slot='page-shell']",
                    popover: {
                      title: "Layer 2: PageShell",
                      description: "48px locked header, standard max-5xl padding, semantic canvas.",
                    },
                  },
                ],
              })
            }
          >
            Start Tour
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Cache refreshed (simulated)")}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            hotkey="⌘S"
            onClick={() => toast.success("Tokens verified against OKLCH spec!")}
          >
            Verify Tokens
          </Button>
        </div>
      }
    >
      <Toaster />

      {/* Global Command Bar Playground Integration */}
      <div className="mb-4">
        <CommandBar
          items={[
            {
              id: "goto-issues",
              label: "Go to Issues",
              group: "Navigation",
              shortcut: "G I",
              icon: <Terminal className="size-4" />,
              onSelect: () => toast.info("Navigate to Issues"),
            },
            {
              id: "goto-settings",
              label: "Open Project Settings",
              group: "Navigation",
              shortcut: "G S",
              icon: <Gear className="size-4" />,
              onSelect: () => toast.info("Navigate to Settings"),
            },
            {
              id: "trigger-alert",
              label: "Simulate Escalating Alert",
              group: "Actions",
              shortcut: "⌘E",
              icon: <Flame className="size-4 text-escalating" />,
              onSelect: () => toast.error("Escalating incident triggered!"),
            },
          ]}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="primitives">Layer 1: Primitives</TabsTrigger>
          <TabsTrigger value="kit">Layer 2: Composite Kit</TabsTrigger>
          <TabsTrigger value="states">4-State Stress Test</TabsTrigger>
          <TabsTrigger value="micro-physics">Micro-Physics & Optics</TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: LAYER 1 PRIMITIVES ===================== */}
        <TabsContent value="primitives" className="space-y-6">
          {/* BUTTONS */}
          <SectionCard
            title="Button Primitives (Unified Control Heights: xs=24px, sm=28px, md=32px)"
            description="Bakes shadow-tactile, 100ms transitions, 0.5px press depressions, and native hotkey/loading slots."
          >
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-fg-muted mb-2 font-mono">Variants (size sm = 28px)</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">Primary CTA</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="secondary" hotkey="⌘K">With Hotkey</Button>
                  <Button variant="secondary" loading>Loading</Button>
                  <Button variant="secondary" disabled>Disabled</Button>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-fg-muted mb-2 font-mono">Heights & Icon Sizes</p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="xs">XS (24px)</Button>
                  <Button variant="secondary" size="sm">SM (28px)</Button>
                  <Button variant="secondary" size="md">MD (32px)</Button>
                  <Button variant="outline" size="icon" title="Settings">
                    <Gear weight="bold" />
                  </Button>
                  <Button variant="outline" size="icon-xs" title="Terminal">
                    <Terminal weight="bold" />
                  </Button>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-xs bg-surface-2 text-fg-muted">
                    <span className="text-[11px]">Icon wrapper:</span>
                    <Icon icon={ArrowRight} size={14} />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* INPUTS & SELECT */}
          <SectionCard
            title="Inputs, Search Omnibar & Select"
            description="Integrated leading icons, trailing shortcut badges, and locked heights."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-medium text-fg-muted block mb-1.5">
                  Search Input (sm = 28px)
                </label>
                <Input
                  size="sm"
                  placeholder="Search issues, traces..."
                  leadingIcon={<MagnifyingGlass />}
                  trailingShortcut="/"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-fg-muted block mb-1.5">
                  Standard Input (md = 32px)
                </label>
                <Input
                  size="md"
                  placeholder="webhook_endpoint_url"
                  defaultValue="https://api.internal.net/v1/webhook"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-fg-muted block mb-1.5">
                  Select Dropdown (sm = 28px)
                </label>
                <Select defaultValue="unresolved">
                  <SelectTrigger size="sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unresolved">is:unresolved</SelectItem>
                    <SelectItem value="escalating">is:escalating</SelectItem>
                    <SelectItem value="resolved">is:resolved</SelectItem>
                    <SelectItem value="ignored">is:ignored</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* CHECKBOXES & BADGES */}
          <SectionCard
            title="Zero-Shift Checkbox & Semantic Badges"
            description="16x16px locked hit target with ring-inset so adjacent elements shift exactly 0px."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-fg-muted">Checkboxes (0px layout shift)</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={checkbox1}
                      onCheckedChange={(val) => setCheckbox1(Boolean(val))}
                    />
                    <span className="text-xs text-fg-primary">Default Checkbox</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={checkbox2}
                      onCheckedChange={(val) => setCheckbox2(Boolean(val))}
                    />
                    <span className="text-xs text-fg-primary">Checked</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked="indeterminate"
                    />
                    <span className="text-xs text-fg-primary">Indeterminate</span>
                  </label>

                  <label className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                    <Checkbox disabled checked />
                    <span className="text-xs text-fg-muted">Disabled</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-mono text-fg-muted">Semantic Status Badges</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">neutral</Badge>
                  <Badge variant="escalating" dot>escalating</Badge>
                  <Badge variant="regression" dot>regression</Badge>
                  <Badge variant="healthy" dot>healthy</Badge>
                  <Badge variant="info" dot>info</Badge>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* MODALS, SHEETS, DROPDOWNS & TOASTS */}
          <SectionCard
            title="Overlays: Dialog, Slide-over Sheet, Dropdown & Toast"
            description="Accessible modals and floating layers wrapped with obsidian tokens and tactile hairlines."
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* Dialog */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Open Dialog
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Triage Diagnostic</DialogTitle>
                    <DialogDescription>
                      Review suspected null pointer exception in payment pipeline.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2 text-xs text-fg-secondary">
                    <p className="font-mono bg-surface-2 p-2 rounded-xs border border-border-subtle text-[11px]">
                      TypeError: Cannot read properties of undefined (reading &apos;customer_id&apos;)
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => {
                      setDialogOpen(false);
                      toast.success("Applied triage resolution!");
                    }}>
                      Apply Fix
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Sheet */}
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    Open Sheet Drawer
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Raw Event Payload</SheetTitle>
                    <SheetDescription>
                      Captured envelope timestamp 2026-10-24 13:00:00 UTC
                    </SheetDescription>
                  </SheetHeader>
                  <pre className="font-mono text-[11px] bg-surface-2 p-3 rounded-xs border border-border-subtle overflow-auto max-h-[400px]">
{JSON.stringify({ event_id: "epure-evt-9912", level: "error", timestamp: 1729774800, culprit: "checkout::process_payment", user: { id: "usr_8231", ip: "127.0.0.1" } }, null, 2)}
                  </pre>
                  <SheetFooter>
                    <Button variant="secondary" size="sm" onClick={() => setSheetOpen(false)}>
                      Close
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              {/* Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Dropdown Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Triage Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => toast.success("Marked resolved")}>
                    Resolve Issue
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Snoozed 24 hours")}>
                    Snooze (24h)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-escalating" onClick={() => toast.error("Deleted issue")}>
                    Delete Issue
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Popover
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <h4 className="font-semibold text-xs text-fg-primary mb-1">Issue Occurrence Rate</h4>
                  <p className="text-[11px] text-fg-muted">
                    This issue spiked by +320% in the last 48 hours following release v2.4.1.
                  </p>
                </PopoverContent>
              </Popover>

              {/* Tooltip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm">
                    Hover for Tooltip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>Keyboard shortcut: G then I</span>
                </TooltipContent>
              </Tooltip>

              {/* Toast Triggers */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toast.success("Mutation synced optimistically!")}
              >
                Toast Success
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toast.error("Rust backend connection timed out.")}
              >
                Toast Error
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ===================== TAB 2: LAYER 2 COMPOSITE KIT ===================== */}
        <TabsContent value="kit" className="space-y-6">
          {/* FILTER BAR */}
          <SectionCard
            title="FilterBar (URL-synced faceted filtering)"
            description="Leading [All] reset button with count badges and active states."
          >
            <FilterBar
              options={[
                { key: "unresolved", label: "Unresolved", count: 42 },
                { key: "escalating", label: "Escalating", count: 5 },
                { key: "regressed", label: "Regressed", count: 2 },
                { key: "archived", label: "Archived", count: 180 },
              ]}
              activeKey={filterKey}
              onSelect={setFilterKey}
              onReset={() => setFilterKey("all")}
            />
          </SectionCard>

          {/* ISSUE ROW SHELL */}
          <SectionCard
            title="IssueRowShell (Locked CSS Grid Track & Zero Layout Shift)"
            description="Never shifts adjacent cells on checkbox click. 2px left crimson-orange bar for escalating spikes."
          >
            <div className="border border-border-subtle rounded-control overflow-hidden bg-surface-1">
              <IssueRowShell
                id="issue-1"
                selected={rowSelected}
                onSelectChange={setRowSelected}
                escalating={true}
                statusBadge={<Badge variant="escalating" size="sm" dot>Spike</Badge>}
                title="NullPointerException in PaymentProcessingService"
                subtitle="checkout.service.ts:142"
                sparkline={
                  <div className="w-20 h-5">
                    <TelemetryChart data={mockTelemetry} height={20} color="escalating" showAxes={false} />
                  </div>
                }
                eventsCount="14,290"
                usersCount="832"
                timeAgo="2m ago"
              />

              <IssueRowShell
                id="issue-2"
                selected={false}
                escalating={false}
                statusBadge={<Badge variant="regression" size="sm" dot>Regression</Badge>}
                title="Database lock timeout on user_tokens_partition"
                subtitle="auth/session.rs:88"
                sparkline={
                  <div className="w-20 h-5">
                    <TelemetryChart data={mockTelemetry} height={20} color="regression" showAxes={false} />
                  </div>
                }
                eventsCount="2,104"
                usersCount="149"
                timeAgo="14m ago"
              />

              <IssueRowShell
                id="issue-3"
                selected={false}
                escalating={false}
                statusBadge={<Badge variant="healthy" size="sm" dot>Resolved</Badge>}
                title="Failed to parse malformed JSON envelope in ingest webhook"
                subtitle="ingest/envelope.rs:215"
                eventsCount="39"
                usersCount="1"
                timeAgo="3h ago"
              />
            </div>
          </SectionCard>

          {/* TELEMETRY CHART */}
          <SectionCard
            title="TelemetryChart (Vercel-style Recharts with locked dark crosshair)"
            description="Semantic status gradient fills mapped directly to Layer 0 CSS variables."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border-subtle p-3 rounded-control bg-surface-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-fg-primary">Escalating Errors (3d)</span>
                  <Badge variant="escalating" size="sm">+340%</Badge>
                </div>
                <TelemetryChart data={mockTelemetry} height={120} color="escalating" />
              </div>

              <div className="border border-border-subtle p-3 rounded-control bg-surface-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-fg-primary">Healthy System Throughput</span>
                  <Badge variant="healthy" size="sm">99.98%</Badge>
                </div>
                <TelemetryChart data={mockTelemetry} height={120} color="healthy" />
              </div>
            </div>
          </SectionCard>

          {/* ASK AGENT & USAGE METERS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AskAgentCard
              title="Copilot Diagnosis"
              description="Analyze stack trace, git blame, and suspect commit to synthesize a unified fix prompt."
              promptText="Explain the root cause of NullPointerException in checkout.service.ts:142 and propose a minimal fix."
              onAskAgent={() => toast.info("Opening AI Assistant...")}
            />

            <div className="space-y-4">
              <UsageMeterCard
                label="Monthly Event Ingest Quota"
                used={450000}
                limit={1000000}
              />
              <UsageMeterCard
                label="Active Seat Retention"
                used={9}
                limit={10}
                unit="seats"
              />
            </div>
          </div>

          {/* EMPTY STATE */}
          <EmptyState
            title="No Unresolved Issues"
            description="All captured errors have been snoozed, merged, or marked resolved."
            actionLabel="View Resolved Issues"
            onAction={() => toast.info("Switching view to resolved")}
          />

          {/* DATA TABLE (TANSTACK TABLE V8 + TANSTACK VIRTUAL) */}
          <SectionCard
            title="DataTable (@tanstack/react-table v8 + @tanstack/react-virtual)"
            description="Locked height tracks, virtualized DOM at 120fps, and standard sorting/padding."
          >
            <DataTable
              columns={mockColumns}
              data={mockTableRows}
              height={200}
              onRowClick={(row) => toast.info(`Selected service: ${row.name}`)}
            />
          </SectionCard>

          {/* CODE FRAME (SHIKI SYNTAX HIGHLIGHTING) */}
          <SectionCard
            title="CodeFrame (Shiki Syntax Highlighting with Obsidian Palette)"
            description="VS Code TextMate token engine rendered with semantic obsidian background and copy actions."
          >
            <CodeFrame
              filename="crates/ingest/src/lib.rs"
              language="typescript"
              code={sampleCodeSnippet}
              highlightLine={3}
            />
          </SectionCard>
        </TabsContent>

        {/* ===================== TAB 3: 4-STATE STRESS TEST ===================== */}
        <TabsContent value="states" className="space-y-6">
          <SectionCard
            title="4-State Stress Matrix (Default, Active/Focused, Busy/Loading, Error/Extreme)"
            description="Verifies that all components render gracefully in all 4 foundational states."
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* STATE 1: DEFAULT */}
              <div className="border border-border-subtle p-3 rounded-control bg-surface-1 space-y-3">
                <h4 className="text-xs font-semibold text-fg-primary border-b border-border-subtle pb-1.5 flex items-center gap-1.5">
                  <CheckCircle className="size-3.5 text-healthy" />
                  1. Default / Idle
                </h4>
                <Button variant="secondary" size="sm" className="w-full">
                  Normal Button
                </Button>
                <Input size="sm" placeholder="Search..." />
                <Badge variant="neutral">Status: Idle</Badge>
                <div className="text-[11px] text-fg-muted font-mono tabular-nums">
                  Latency: 12ms | 0 errors
                </div>
              </div>

              {/* STATE 2: ACTIVE / FOCUSED */}
              <div className="border border-border-strong p-3 rounded-control bg-surface-2/60 space-y-3">
                <h4 className="text-xs font-semibold text-fg-primary border-b border-border-subtle pb-1.5 flex items-center gap-1.5">
                  <Sparkle className="size-3.5 text-primary" />
                  2. Active / Selected
                </h4>
                <Button variant="primary" size="sm" className="w-full">
                  Selected CTA
                </Button>
                <Input size="sm" defaultValue="active-query" />
                <Badge variant="info" dot>Status: Active</Badge>
                <div className="text-[11px] text-fg-primary font-mono tabular-nums">
                  Active connection: TLS 1.3
                </div>
              </div>

              {/* STATE 3: BUSY / LOADING */}
              <div className="border border-border-subtle p-3 rounded-control bg-surface-1 space-y-3">
                <h4 className="text-xs font-semibold text-fg-primary border-b border-border-subtle pb-1.5 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-regression" />
                  3. Busy / Loading
                </h4>
                <Button variant="secondary" size="sm" loading className="w-full">
                  Processing...
                </Button>
                <Input size="sm" disabled placeholder="Syncing database..." />
                <Badge variant="regression" dot>Optimistic Sync</Badge>
                <div className="text-[11px] text-fg-muted font-mono tabular-nums">
                  Transmitting 1,490 packets...
                </div>
              </div>

              {/* STATE 4: ERROR / CRITICAL */}
              <div className="border border-escalating/40 p-3 rounded-control bg-surface-1 space-y-3">
                <h4 className="text-xs font-semibold text-escalating border-b border-escalating/30 pb-1.5 flex items-center gap-1.5">
                  <ShieldWarning className="size-3.5 text-escalating" />
                  4. Error / Escalating
                </h4>
                <Button variant="danger" size="sm" className="w-full">
                  Resolve Critical Spike
                </Button>
                <Input size="sm" defaultValue="ERR_HTTP2_SESSION_TIMEOUT" className="text-escalating" />
                <Badge variant="escalating" dot>Critical Severity</Badge>
                <div className="text-[11px] text-escalating font-mono tabular-nums font-semibold">
                  Spike: +4,200 events/sec
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ===================== TAB 4: MICRO-PHYSICS & OPTICS ===================== */}
        <TabsContent value="micro-physics" className="space-y-6">
          <SectionCard
            title="Optical Craft & Micro-Physics Audit"
            description="Validates the strict 3 font size law, 24px/28px/32px height grid, and 0px jitter law."
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-fg-primary mb-2">1. The 3-Size Operational Typography Scale</h4>
                <div className="space-y-2 border border-border-subtle p-3 rounded-control bg-surface-1">
                  <div className="flex items-baseline gap-4">
                    <span className="text-[11px] font-mono text-fg-muted w-24">11px (text-[11px]):</span>
                    <span className="text-[11px] text-fg-muted">
                      Metadata, hotkey pills (⌘K), timestamps (12m ago), table headers, and badges.
                    </span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="text-xs font-mono text-fg-muted w-24">12px (text-xs):</span>
                    <span className="text-xs text-fg-primary">
                      All interactive controls, button labels, input placeholders, table row cells, and body text.
                    </span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <span className="text-sm font-mono text-fg-muted w-24">14–16px:</span>
                    <span className="text-sm font-semibold tracking-[-0.02em] text-fg-primary">
                      Section and page headers with tight optical tracking.
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-fg-primary mb-2">2. Unified Control Height Alignment (xs=24px, sm=28px, md=32px)</h4>
                <div className="flex items-center gap-3 border border-border-subtle p-3 rounded-control bg-surface-1">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="xs">h-6 (24px)</Button>
                    <Badge variant="neutral" size="sm">20px badge</Badge>
                  </div>
                  <div className="h-6 w-px bg-border-subtle mx-2" />
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm">h-7 (28px)</Button>
                    <Input size="sm" placeholder="Input h-7" className="w-32" />
                    <Select defaultValue="1">
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Option 1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-6 w-px bg-border-subtle mx-2" />
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="md">h-8 (32px)</Button>
                    <Input size="md" placeholder="Input h-8" className="w-32" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-fg-primary mb-2">3. Tabular Numeric Stability (Zero Jitter)</h4>
                <div className="flex items-center gap-6 border border-border-subtle p-3 rounded-control bg-surface-1 font-mono text-xs tabular-nums">
                  <div>Counter: <span className="text-fg-primary font-bold">14,920,102</span></div>
                  <div>Latency: <span className="text-fg-secondary">14.28ms</span></div>
                  <div>ID: <span className="text-fg-muted">#82910</span></div>
                  <div>Delta: <span className="text-healthy">+0.04%</span></div>
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
export default DesignSystemPlayground;
