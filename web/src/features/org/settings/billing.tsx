import { ArrowRight, Check, ExternalLink, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CLOUD_PLANS,
  CLOUD_UPGRADE_URL,
  PLANS,
  type PlanDefinition,
  type PlanId,
} from "../billing-data";
import { fetchHeadlineStats } from "../../../lib/api";
import { isCloudDeployment } from "../../../lib/deployment";
import { usagePath } from "../../../lib/paths";
import { useAppContext } from "../../../shell/app-context";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent } from "../../../ui/card";
import { SectionHeader } from "../../../ui/section";
import { StatBar } from "../../../ui/stat-bar";

const CLOUD_CURRENT_PLAN: PlanId = "pro";

function formatEvents(value: number | null): string {
  if (value === null) {
    return "Unlimited";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return value.toLocaleString();
}

function planById(id: PlanId): PlanDefinition {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

function WorkspaceUsageStrip() {
  const { projects } = useAppContext();
  const [events7d, setEvents7d] = useState<number | null>(null);
  const [unresolved, setUnresolved] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projects.length === 0) {
      setEvents7d(0);
      setUnresolved(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all(projects.map((project) => fetchHeadlineStats(project.id)))
      .then((stats) => {
        if (cancelled) {
          return;
        }
        setEvents7d(stats.reduce((sum, row) => sum + row.events_7d, 0));
        setUnresolved(stats.reduce((sum, row) => sum + row.unresolved, 0));
      })
      .catch(() => {
        if (!cancelled) {
          setEvents7d(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projects]);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading usage…</p>;
  }

  if (events7d === null) {
    return <p className="text-sm text-ink-muted">Unable to load usage.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <StatBar
        className="min-w-0 flex-1 rounded-lg border border-border !border-b !px-4 !py-3"
        items={[
          { label: "Events (7d)", value: events7d },
          { label: "Unresolved", value: unresolved },
          { label: "Projects", value: projects.length },
        ]}
      />
      <Button variant="ghost" size="sm" asChild className="shrink-0">
        <Link to={usagePath()} className="gap-1.5 text-xs">
          Usage details
          <ArrowRight size={14} />
        </Link>
      </Button>
    </div>
  );
}

function SelfHostedBilling() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-bg-subtle">
              <Server size={16} className="text-accent" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium text-ink">Self-hosted</h2>
                <Badge variant="env">OSS</Badge>
              </div>
              <p className="text-xs text-ink-muted">Apache 2.0. No subscription on this install.</p>
            </div>
          </div>
          <p className="font-mono text-lg font-medium tabular-nums text-ink">$0</p>
        </CardContent>
      </Card>

      <WorkspaceUsageStrip />

      <p className="text-sm text-ink-muted">
        Epure Cloud is not available on this instance yet. Pro ($24/mo) and Plus ($79/mo) launch on{" "}
        <a
          href={CLOUD_UPGRADE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-ink underline-offset-2 hover:underline"
        >
          epure.sh
          <ExternalLink size={12} className="opacity-70" aria-hidden />
        </a>
        .{" "}
        <a
          href={CLOUD_UPGRADE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-ink underline-offset-2 hover:underline"
        >
          Join the waitlist
        </a>
        .
      </p>
    </div>
  );
}

function CloudUsageMeter({ monthlyLimit }: { monthlyLimit: number }) {
  const { projects } = useAppContext();
  const [events7d, setEvents7d] = useState<number | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setEvents7d(0);
      return;
    }
    void Promise.all(projects.map((p) => fetchHeadlineStats(p.id)))
      .then((stats) => setEvents7d(stats.reduce((sum, row) => sum + row.events_7d, 0)))
      .catch(() => setEvents7d(null));
  }, [projects]);

  const projected = events7d !== null ? Math.round(events7d * (30 / 7)) : null;
  const percent =
    projected !== null ? Math.min(100, Math.round((projected / monthlyLimit) * 100)) : 0;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <SectionHeader
          title="Included volume"
          description="7-day projection. Soft sampling before hard limits."
        />
        {projected === null ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-lg font-medium tabular-nums text-ink">
                {formatEvents(projected)}
                <span className="text-sm font-normal text-ink-muted">
                  {" "}
                  / {formatEvents(monthlyLimit)} projected
                </span>
              </p>
              <span className="text-xs text-ink-muted">{percent}%</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-bg-subtle"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Projected monthly event usage"
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PlanOptionCard({
  plan,
  isCurrent,
  upgradeOnly,
}: {
  plan: PlanDefinition;
  isCurrent?: boolean;
  upgradeOnly?: boolean;
}) {
  return (
    <Card
      className={
        plan.highlighted && !isCurrent
          ? "border-accent/30"
          : isCurrent
            ? "border-accent/40 bg-accent-muted/5"
            : undefined
      }
    >
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-medium text-ink">{plan.name}</h3>
          {isCurrent ? <Badge variant="env">Current</Badge> : null}
          {plan.highlighted && !isCurrent ? (
            <Badge variant="secondary" className="text-2xs uppercase">
              Popular
            </Badge>
          ) : null}
        </div>

        <p className="mt-3 font-mono text-2xl font-medium tabular-nums text-ink">
          {plan.price}
          {plan.period ? (
            <span className="text-sm font-normal text-ink-muted">{plan.period}</span>
          ) : null}
        </p>

        <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-muted">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check size={14} className="mt-0.5 shrink-0 text-signal" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {upgradeOnly ? (
          <Button variant={plan.highlighted ? "signal" : "secondary"} className="mt-4 w-full" asChild>
            <a href={CLOUD_UPGRADE_URL} target="_blank" rel="noreferrer" className="gap-1.5">
              Join waitlist
              <ExternalLink size={14} />
            </a>
          </Button>
        ) : isCurrent ? (
          <Button variant="secondary" className="mt-4 w-full" disabled>
            Current plan
          </Button>
        ) : (
          <Button variant="secondary" className="mt-4 w-full" disabled>
            Switch to {plan.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CloudBilling({ isOwner }: { isOwner: boolean }) {
  const currentPlan = planById(CLOUD_CURRENT_PLAN);
  const plan = planById(CLOUD_CURRENT_PLAN);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium text-ink">{plan.name}</h2>
              <Badge variant="env">Cloud</Badge>
            </div>
            <p className="text-xs text-ink-muted">{plan.description}</p>
          </div>
          <p className="font-mono text-lg font-medium tabular-nums text-ink">
            {plan.price}
            {plan.period ? (
              <span className="text-sm font-normal text-ink-muted">{plan.period}</span>
            ) : null}
          </p>
        </CardContent>
      </Card>

      <CloudUsageMeter monthlyLimit={currentPlan.limits.eventsPerMonth ?? 200_000} />

      <div className="space-y-3">
        <SectionHeader
          title="Plans"
          description={
            isOwner ? "Flat monthly rate." : "Workspace owners manage plan changes."
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {CLOUD_PLANS.map((p) => (
            <PlanOptionCard key={p.id} plan={p} isCurrent={p.id === CLOUD_CURRENT_PLAN} />
          ))}
        </div>
      </div>

      {isOwner ? (
        <p className="text-xs text-ink-muted">Stripe checkout and invoices coming soon.</p>
      ) : (
        <p className="text-xs text-ink-muted">Ask your workspace owner to manage billing.</p>
      )}
    </div>
  );
}

export function OrgBillingSettings() {
  const { user } = useAppContext();
  const cloud = isCloudDeployment();
  const isOwner = user?.role === "owner";

  if (!cloud) {
    return <SelfHostedBilling />;
  }

  return <CloudBilling isOwner={isOwner} />;
}
