import { ArrowRight, Check, ExternalLink, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BILLING_FAQ,
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
import { Section, SectionHeader } from "../../../ui/section";
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
    <div className="space-y-3">
      <StatBar
        className="rounded-lg border border-border !border-b !px-4 !py-3"
        items={[
          { label: "Events (7d)", value: events7d },
          { label: "Unresolved", value: unresolved },
          { label: "Projects", value: projects.length },
        ]}
      />
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <Link to={usagePath()} className="gap-1.5 text-xs">
            Full usage breakdown
            <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DeploymentStatusCard({ cloud }: { cloud: boolean }) {
  const plan = cloud ? planById(CLOUD_CURRENT_PLAN) : planById("oss");

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="border-b border-border bg-surface-elevated px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-bg">
                <Server size={18} className="text-accent" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-medium text-ink">
                    {cloud ? `${plan.name} plan` : "Self-hosted"}
                  </h2>
                  <Badge variant="env">{cloud ? "Cloud" : "OSS"}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{plan.description}</p>
              </div>
            </div>
            <p className="font-mono text-2xl font-medium tabular-nums text-ink">
              {plan.price ?? "$0"}
              {plan.period ? (
                <span className="text-sm font-normal text-ink-muted">{plan.period}</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3">
          <StatusFact
            label="Events"
            value={
              plan.limits.eventsPerMonth
                ? `${formatEvents(plan.limits.eventsPerMonth)} / mo included`
                : "Unlimited (your hardware)"
            }
          />
          <StatusFact
            label="Retention"
            value={
              plan.limits.retentionDays
                ? `${plan.limits.retentionDays} days`
                : "Per-project config"
            }
          />
          <StatusFact
            label="Billing"
            value={cloud ? "Flat monthly rate" : "No subscription"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-5 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
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
      <CardContent className="space-y-3 p-5">
        <SectionHeader
          title="Included volume"
          description="Projection from your last 7 days. No overage invoices — soft sampling applies first."
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
          ? "border-accent/30 shadow-sm"
          : isCurrent
            ? "border-accent/40 bg-accent-muted/5"
            : undefined
      }
    >
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-medium text-ink">{plan.name}</h3>
          {isCurrent ? <Badge variant="env">Current</Badge> : null}
          {plan.highlighted && !isCurrent ? (
            <Badge variant="secondary" className="text-2xs uppercase">Popular</Badge>
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
          <Button variant={plan.highlighted ? "signal" : "secondary"} className="mt-5 w-full" asChild>
            <a href={CLOUD_UPGRADE_URL} target="_blank" rel="noreferrer" className="gap-1.5">
              Get {plan.name}
              <ExternalLink size={14} />
            </a>
          </Button>
        ) : isCurrent ? (
          <Button variant="secondary" className="mt-5 w-full" disabled>
            Current plan
          </Button>
        ) : (
          <Button variant="secondary" className="mt-5 w-full" disabled>
            Switch to {plan.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function BillingFaq() {
  return (
    <Section variant="inset">
      <SectionHeader title="Common questions" />
      <div className="mt-3 divide-y divide-border">
        {BILLING_FAQ.map((item) => (
          <details key={item.question} className="group py-3 first:pt-0 last:pb-0">
            <summary className="cursor-pointer list-none text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                {item.question}
                <span className="text-ink-muted transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function CloudBillingExtras({ isOwner }: { isOwner: boolean }) {
  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Payment method</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {isOwner
                ? "Stripe checkout coming soon — no card on file yet."
                : "Ask your workspace owner to manage billing."}
            </p>
          </div>
          {isOwner ? (
            <Button variant="secondary" size="sm" disabled>
              Add card
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Invoices</p>
            <p className="mt-0.5 text-sm text-ink-muted">No invoices yet.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrgBillingSettings() {
  const { user } = useAppContext();
  const cloud = isCloudDeployment();
  const isOwner = user?.role === "owner";
  const currentPlan = planById(CLOUD_CURRENT_PLAN);

  if (!cloud) {
    return (
      <div className="space-y-6">
        <DeploymentStatusCard cloud={false} />
        <WorkspaceUsageStrip />

        <div className="space-y-3">
          <SectionHeader
            title="Managed Cloud"
            description="Same core product — we run Postgres, TLS, and backups. Flat $24 or $79 per month. No per-event overages."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {CLOUD_PLANS.map((plan) => (
              <PlanOptionCard key={plan.id} plan={plan} upgradeOnly />
            ))}
          </div>
          <p className="text-center text-xs text-ink-muted">
            Join the waitlist at{" "}
            <a
              href={CLOUD_UPGRADE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline-offset-2 hover:underline"
            >
              epure.sh
            </a>
            {" "}— Cloud ships in Phase 2.
          </p>
        </div>

        <BillingFaq />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DeploymentStatusCard cloud={true} />
      <CloudUsageMeter monthlyLimit={currentPlan.limits.eventsPerMonth ?? 200_000} />

      <div className="space-y-3">
        <SectionHeader
          title="Plans"
          description={
            isOwner
              ? "Flat monthly rate. Upgrade or downgrade anytime."
              : "Only workspace owners can change plans."
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {CLOUD_PLANS.map((plan) => (
            <PlanOptionCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === CLOUD_CURRENT_PLAN}
            />
          ))}
        </div>
      </div>

      <CloudBillingExtras isOwner={isOwner} />
      <BillingFaq />
    </div>
  );
}
