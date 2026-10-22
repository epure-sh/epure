export type PlanId =
  | "oss"
  | "pro"
  | "scale"
  | "canary_sandbox"
  | "builder_pro"
  | "multi_app_studio"
  | "team_plus"
  | "boutique_agency"
  | "agency"
  | "dedicated_sovereign";

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
  tierCode?: "pro" | "scale" | "team_plus" | "agency" | "dedicated";
  comingSoon?: boolean;
}

export function normalizePlanId(id: string | null | undefined): PlanId {
  if (!id) return "pro";
  const lower = id.toLowerCase();
  if (lower === "pro" || lower === "builder_pro") return "pro";
  if (
    lower === "scale" ||
    lower === "team_plus" ||
    lower === "multi_app_studio" ||
    lower === "plus" ||
    lower === "agency" ||
    lower === "boutique_agency" ||
    lower === "dedicated" ||
    lower === "dedicated_sovereign" ||
    lower === "enterprise"
  ) {
    return "scale";
  }
  if (lower === "canary_sandbox") return "canary_sandbox";
  if (lower === "oss" || lower === "self_hosted") return "oss";
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
    id: "canary_sandbox",
    name: "Cloud 7-Day Trial",
    price: "$0",
    priceMonthly: "$0",
    priceAnnual: "$0",
    period: "7-day pilot",
    tierCode: "pro",
    description: "Full-featured Epure Cloud canary workspace with active Spike Valve protection and native AI agent triage.",
    features: [
      "100,000 events included during 7-day trial",
      "Spike Valve crash loop immunity active",
      "Full Source Map demangling + epure-mcp",
      "Native Claude Code & Cursor MCP triage",
      "Pre-seeded production error context & breadcrumbs",
      "Instant 1-click upgrade to Pro",
    ],
    limits: {
      maxProjects: 1,
      eventsPerMonth: 100_000,
      retentionDays: 14,
    },
    cloudOnly: false,
  },
  {
    id: "pro",
    name: "Cloud Pro",
    price: "$29",
    priceMonthly: "$29",
    priceAnnual: "$24",
    period: "/ mo",
    tierCode: "pro",
    description: "Production-ready error tracking with zero-maintenance hosting, guaranteed $0 overage protection, and surgical AI triage.",
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
    description: "High-volume systems and growing engineering organizations needing expanded retention, multi-org isolation, and unlimited scale.",
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
    comingSoon: true,
  },
];

export const CLOUD_PLANS = PLANS.filter((plan) => plan.cloudOnly);

export const CLOUD_UPGRADE_URL = "https://epure.sh/pricing";
