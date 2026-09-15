import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Empty } from "../../ui/empty";
import { CopyButton } from "../../ui/copy-button";
import { CopyDsnBlock } from "../../ui/copy-dsn-block";
import { FilterChip } from "../../ui/filter-chip";
import { FilterPanel } from "../../ui/filter-panel";
import {
  DETAIL_TOOLBAR_BUTTON_CLASS,
  IssueDetailTabs,
} from "../../ui/issue-detail-tabs";
import { IssueOverviewPanel } from "../../ui/issue-overview-panel";
import { SetupChecklist } from "../../ui/setup-checklist";
import { StatBar } from "../../ui/stat-bar";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Input } from "../../ui/input";
import { IssueRow } from "../../ui/issue-row";
import { Kbd } from "../../ui/kbd";
import { ListRow } from "../../ui/list-row";
import { PageChrome } from "../../ui/page-chrome";
import { Section, SectionHeader } from "../../ui/section";
import { IssueRowSkeleton, Skeleton } from "../../ui/skeleton";

const swatches = [
  { name: "bg", className: "bg-bg" },
  { name: "bg-subtle", className: "bg-bg-subtle" },
  { name: "surface", className: "bg-surface" },
  { name: "accent", className: "bg-accent" },
  { name: "signal", className: "bg-signal" },
  { name: "success", className: "bg-semantic-success" },
  { name: "warning", className: "bg-semantic-warning" },
  { name: "danger", className: "bg-semantic-danger" },
] as const;

function LabSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="epure-section-header-title text-sm font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function DesignLabPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageChrome
        title="Design Lab"
        description="Preview tokens and ui/ primitives. Edit design/tokens.css and reload."
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-5xl gap-10 p-6">
        <LabSection title="Tokens">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {swatches.map((swatch) => (
              <div key={swatch.name} className="space-y-1.5">
                <div
                  className={`h-12 rounded-md border border-border ${swatch.className}`}
                />
                <p className="font-mono text-2xs text-ink-muted">{swatch.name}</p>
              </div>
            ))}
          </div>
        </LabSection>

        <LabSection title="Theme guide (use bottom switcher)">
          <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-ink-muted lg:grid-cols-3">
            <div>
              <p className="font-medium text-ink">Calm Ledger</p>
              <p className="mt-1 text-xs">Pill buttons · card stat metrics · airy gap rows · underline tabs · dashed empty</p>
            </div>
            <div>
              <p className="font-medium text-ink">Quiet Ledger</p>
              <p className="mt-1 text-xs">Editorial serif stats · rule-separated rows · text badges · underline inputs · black CTA only</p>
            </div>
            <div>
              <p className="font-medium text-ink">Calm Dense</p>
              <p className="mt-1 text-xs">Mono inline stat strip · 3-line dense rows · square 2px controls · inset wells</p>
            </div>
          </div>
        </LabSection>

        <LabSection title="Theme structure (switch bottom bar)">
          <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 lg:grid-cols-3">
            <div className="space-y-3">
              <SectionHeader title="Section header" />
              <IssueRow
                title="TypeError: Cannot read properties of undefined"
                lastSeen="2h ago"
                eventCount={42}
                environment="production"
                unread
              />
            </div>
            <StatBar
              items={[
                { label: "Unresolved", value: 12 },
                { label: "Events (7d)", value: 1402 },
                { label: "Regressions", value: 2 },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <FilterChip label="is:unresolved" active />
            </div>
          </div>
        </LabSection>

        <LabSection title="Typography">
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
            <p className="epure-page-title font-medium tracking-ui text-ink">Page title — theme-sized</p>
            <p className="font-mono text-lg text-ink">IBM Plex Mono — stack traces only</p>
            <p className="font-mono-slash text-sm text-ink-muted">Slashed zero · 1,024 events</p>
          </div>
        </LabSection>

        <LabSection title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </LabSection>

        <LabSection title="Badges & chips">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="env">production</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="error">error</Badge>
            <FilterChip label="Unresolved" active />
            <FilterChip label="Error" active={false} />
            <Kbd keys="⌘K" />
          </div>
        </LabSection>

        <LabSection title="Inputs · Card · Empty">
          <Input placeholder="is:unresolved level:error" className="max-w-md" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card primitive</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-muted">Theme controls radius, shadow, and border treatment.</p>
              </CardContent>
            </Card>
            <Empty title="No unresolved exceptions" description="Typographic or dashed depending on theme." />
          </div>
        </LabSection>

        <LabSection title="Tabs · Popover · Copy">
          <Tabs defaultValue="overview" className="max-w-md">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="stack">Stack</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-3 text-sm text-ink-muted">
              Overview panel preview
            </TabsContent>
            <TabsContent value="stack" className="pt-3 text-sm text-ink-muted">
              Stack panel preview
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary">Filter</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm text-ink-muted">Filter panel preview</p>
              </PopoverContent>
            </Popover>
            <CopyButton value="https://key@localhost/project-id" label="Copy DSN" />
          </div>
        </LabSection>

        <LabSection title="Issue row">
          <div className="overflow-hidden rounded-md border border-border bg-bg">
            <div
              className="hidden border-b border-border lg:grid lg:grid-cols-[2.75rem_minmax(0,1fr)]"
              aria-hidden
            >
              <div className="flex items-center justify-center border-r border-border bg-surface px-2 py-2">
                <span className="h-4 w-4 rounded-sm border border-border-strong bg-surface" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
                <span className="font-mono text-2xs uppercase tracking-wide text-ink-muted">
                  Exception
                </span>
                <span className="font-mono text-2xs uppercase tracking-wide text-ink-muted">
                  Last seen
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[2.75rem_minmax(0,1fr)]">
              <div className="hidden items-stretch border-b border-border bg-surface lg:flex">
                <div className="flex w-full items-center justify-center border-r border-border px-2 py-3" />
              </div>
              <IssueRow
                title="TypeError: Cannot read properties of undefined (reading 'map')"
                lastSeen="2h ago"
                eventCount={42}
                userCount={18}
                level="error"
                environment="production"
                release="2.4.1"
                unread
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[2.75rem_minmax(0,1fr)]">
              <div className="hidden items-stretch border-b border-border bg-state-selected lg:flex">
                <div className="flex w-full items-center justify-center border-r border-border px-2 py-3">
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-accent bg-accent-muted/60" />
                </div>
              </div>
              <IssueRow
                title="ReferenceError: foo is not defined"
                lastSeen="Yesterday"
                eventCount={3}
                level="error"
                environment="staging"
                regression
                selected
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[2.75rem_minmax(0,1fr)]">
              <div className="hidden items-stretch border-b border-border bg-signal-muted/40 lg:flex">
                <div className="flex w-full items-center justify-center border-r border-border px-2 py-3">
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-accent bg-accent-muted/60" />
                </div>
              </div>
              <IssueRow
                title="UnhandledPromiseRejection: Payment API failed"
                lastSeen="5m ago"
                eventCount={128}
                userCount={54}
                level="fatal"
                environment="production"
                release="2.4.0"
                bulkSelected
                snoozed
              />
            </div>
            <IssueRowSkeleton />
          </div>
        </LabSection>

        <LabSection title="Dashboard UX (002)">
          <StatBar
            items={[
              { label: "Unresolved", value: 12 },
              { label: "Events (7d)", value: 340 },
              { label: "Regressions", value: 2 },
            ]}
          />
          <div className="mt-4">
            <FilterPanel
              query="is:unresolved"
              presets={[
                { label: "Unresolved", token: "is:unresolved" },
                { label: "Error", token: "level:error" },
              ]}
              onQueryChange={() => undefined}
            />
          </div>
          <div className="mt-4">
            <CopyDsnBlock dsn="https://key@localhost:8080/project-id" />
          </div>
          <div className="mt-4">
            <SetupChecklist
              projectNamed
              dsnCopied
              testSent={false}
              firstIssueSeen={false}
              complete={false}
            />
          </div>
          <div className="mt-4 rounded-md border border-border">
            <IssueDetailTabs
              onClose={() => undefined}
              actions={
                <>
                  <Button variant="primary" className={DETAIL_TOOLBAR_BUTTON_CLASS}>
                    Resolve
                  </Button>
                  <Button variant="ghost" className={DETAIL_TOOLBAR_BUTTON_CLASS}>
                    Ignore
                  </Button>
                  <Button variant="ghost" className={DETAIL_TOOLBAR_BUTTON_CLASS}>
                    Snooze
                  </Button>
                  <Button variant="ghost" className={DETAIL_TOOLBAR_BUTTON_CLASS}>
                    Copy for AI
                  </Button>
                </>
              }
              stack={<p className="p-4 text-sm text-ink-muted">Stack trace preview</p>}
              overview={
                <IssueOverviewPanel
                  issue={{
                    id: "1",
                    org_id: "1",
                    project_id: "1",
                    title: "TypeError: Cannot read properties of undefined",
                    status: "unresolved",
                    level: "error",
                    environment: "production",
                    release: "1.0.0",
                    event_count: 42,
                    unique_user_count: 18,
                    last_seen_at: new Date().toISOString(),
                    first_seen_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                    resolved_in_release: null,
                    snoozed: false,
                    snooze_until: null,
                    snooze_until_count: null,
                    snooze_until_users: null,
                    fingerprint: "abc123def456",
                  }}
                  event={null}
                  events={[]}
                  timeline={null}
                  timelineWindow="7d"
                  onTimelineWindowChange={() => undefined}
                  selectedEventId={null}
                  onSelectEvent={() => undefined}
                />
              }
              breadcrumbs={<p className="p-4 text-sm text-ink-muted">Breadcrumbs preview</p>}
              more={<p className="p-4 text-sm text-ink-muted">More preview</p>}
            />
          </div>
          <div className="mt-4">
            <Section variant="band">
              <SectionHeader title="Section primitive" description="mono xs uppercase labels" />
              <p className="text-sm text-ink-muted">
                Use <code className="font-mono text-xs">Section</code> +{" "}
                <code className="font-mono text-xs">SectionHeader</code> for in-pane zones.
              </p>
            </Section>
          </div>
        </LabSection>

        <LabSection title="Shell preview">
          <div className="flex h-48 overflow-hidden rounded-lg border border-border">
            <div className="flex w-28 flex-col gap-px border-r border-border bg-bg p-1.5">
              <div className="rounded-sm bg-bg-subtle px-2 py-1 text-xs text-ink">Issues</div>
              <div className="px-2 py-1 text-xs text-ink-muted">Settings</div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-8 items-center gap-1 border-b border-border bg-surface px-2 text-xs">
                <span className="h-5 w-5 rounded-md bg-accent" />
                <span className="text-ink-muted">/</span>
                <span className="text-ink">Org</span>
                <span className="text-ink-muted">/</span>
                <span className="text-ink">Project</span>
                <span className="text-ink-muted">/</span>
                <span className="text-ink">production</span>
              </div>
              <div className="flex-1 bg-bg">
                <Skeleton className="m-4 h-8 w-2/3" />
              </div>
            </div>
          </div>
        </LabSection>

        <LabSection title="List row">
          <div className="flex max-w-lg flex-col gap-1.5">
            <ListRow variant="airy" className="flex-col gap-0.5 px-4 py-2.5">
              <span className="text-sm font-medium text-ink">Alert-style airy row</span>
              <span className="text-xs text-ink-muted">Used on Alerts and Releases</span>
            </ListRow>
            <ListRow variant="airy" accent="danger" className="flex-col gap-0.5 px-4 py-2.5">
              <span className="text-sm font-medium text-ink">Regression accent</span>
              <span className="text-xs text-ink-muted">Left bar uses semantic-danger</span>
            </ListRow>
          </div>
        </LabSection>
        </div>
      </div>
    </div>
  );
}
