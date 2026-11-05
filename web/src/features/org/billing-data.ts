export type PlanId = "oss" | "pro" | "scale";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string | null;
  priceMonthly?: string;
  priceAnnual?: string;
  period: string | null;
  description: string;
  features: string[];
  limits: {
    maxProjects: number | null;
    eventsPerMonth: number | null;
    retentionDays: number | null;
    maxOrgs?: number | null;
    cronMonitors?: number | null;
  };
  highlighted?: boolean;
  cloudOnly?: boolean;
  tierCode?: "pro" | "scale";
  comingSoon?: boolean;
}

/** Map stored plan_tier (Polar legacy + aliases) to oss | pro | scale. */
export function normalizePlanId(id: string | null | undefined): PlanId {
  if (!id) return "pro";
  const lower = id.toLowerCase();
  if (lower === "oss" || lower === "self_hosted") return "oss";
  if (lower === "pro" || lower === "builder_pro" || lower === "canary_sandbox" || lower === "canary") {
    return "pro";
  }
  if (lower === "scale" || lower === "multi_app_studio" || lower === "team_plus" || lower === "plus" || lower === "studio") {
    return "scale";
  }
  if (lower === "agency" || lower === "boutique_agency") return "scale";
  if (lower === "dedicated" || lower === "dedicated_sovereign" || lower === "enterprise") return "scale";
  return "pro";
}

export const PLANS: PlanDefinition[] = [
  {
    id: "oss",
    name: "Self-hosted",
    price: "$0",
    period: null,
    description: "AGPL-3.0. Run Epure on your own server: one binary plus PostgreSQL 16.",
    features: [
      "Error tracking, grouping and alerts",
      "Unlimited projects and members",
      "Per-issue flood isolation with exact counts",
      "Agent context API and MCP",
      "You run PostgreSQL 16 and backups",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: null,
      retentionDays: null,
    },
  },
  {
    id: "pro",
    name: "Cloud Pro",
    price: "$29",
    priceMonthly: "$29",
    period: "/ mo",
    tierCode: "pro",
    description: "Managed Epure for small teams. Flat monthly price.",
    features: [
      "200,000 events / month",
      "No automatic overage. Over quota, every occurrence is still counted",
      "Unlimited projects and seats",
      "30-day retention",
      "5 cron monitors",
      "JS/TS source maps",
      "Email, Slack, Discord, Telegram and webhook alerts",
      "Agent context API and MCP",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: 200_000,
      retentionDays: 30,
      cronMonitors: 5,
    },
    highlighted: true,
    cloudOnly: true,
  },
  {
    id: "scale",
    name: "Cloud Scale",
    price: "$89",
    priceMonthly: "$89",
    period: "/ mo",
    tierCode: "scale",
    description: "More volume and longer retention for busier apps.",
    features: [
      "1,500,000 events / month",
      "No automatic overage. Over quota, every occurrence is still counted",
      "Unlimited projects and seats",
      "90-day retention",
      "Unlimited cron monitors",
      "Everything in Pro",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: 1_500_000,
      retentionDays: 90,
      cronMonitors: null,
    },
    highlighted: false,
    cloudOnly: true,
  },
];

export const CLOUD_PLANS = PLANS.filter((plan) => plan.cloudOnly);

export const CLOUD_UPGRADE_URL = "https://epure.sh/pricing";
