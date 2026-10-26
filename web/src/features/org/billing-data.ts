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
    name: "Self-Hosted OSS",
    price: "$0",
    period: null,
    description: "Apache 2.0. Run Epure on your own infrastructure or VPS.",
    features: [
      "Full exception tracking & grouping",
      "Unlimited projects & team members",
      "Surgical <600-token epure-mcp included",
      "In-memory SHA-256 Spike Valve",
      "You manage PostgreSQL 16 & backups",
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
    priceAnnual: "$24",
    period: "/ mo",
    tierCode: "pro",
    description:
      "Production-ready error tracking with zero-maintenance hosting, guaranteed $0 overage protection, and surgical AI triage.",
    features: [
      "200,000 events / mo included",
      "$0 overage guarantee (Spike Valve protection)",
      "1 organization enforced",
      "Unlimited projects & unlimited seats",
      "35-day event retention",
      "5 cron / heartbeat monitors",
      "Full Source Map demangling + epure-mcp",
      "Email, Slack, Discord & Webhook alerts",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: 200_000,
      retentionDays: 35,
      maxOrgs: 1,
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
    priceAnnual: "$74",
    period: "/ mo",
    tierCode: "scale",
    description:
      "High-volume systems and growing engineering organizations needing expanded retention, multi-org isolation, and unlimited scale.",
    features: [
      "1,500,000 events / mo included",
      "$0 overage guarantee (Spike Valve protection)",
      "Unlimited organizations",
      "Unlimited projects & unlimited seats",
      "90-day event retention",
      "Unlimited cron / heartbeat monitors",
      "Two-way GitHub & Linear issue sync",
      "Priority email & Slack support",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: 1_500_000,
      retentionDays: 90,
      maxOrgs: null,
      cronMonitors: null,
    },
    highlighted: false,
    cloudOnly: true,
  },
];

export const CLOUD_PLANS = PLANS.filter((plan) => plan.cloudOnly);

export const CLOUD_UPGRADE_URL = "https://epure.sh/pricing";
