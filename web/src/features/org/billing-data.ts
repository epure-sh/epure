export type PlanId =
  | "oss"
  | "builder_pro"
  | "pro"
  | "multi_app_studio"
  | "team_plus"
  | "boutique_agency"
  | "agency"
  | "dedicated_sovereign"
  | "canary_sandbox";

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
  };
  highlighted?: boolean;
  cloudOnly?: boolean;
  tierCode?: "pro" | "team_plus" | "agency" | "dedicated";
}

export function normalizePlanId(id: string | null | undefined): PlanId {
  if (!id) return "builder_pro";
  const lower = id.toLowerCase();
  if (lower === "pro" || lower === "builder_pro") return "builder_pro";
  if (lower === "team_plus" || lower === "multi_app_studio" || lower === "plus") return "multi_app_studio";
  if (lower === "agency" || lower === "boutique_agency") return "boutique_agency";
  if (lower === "dedicated" || lower === "dedicated_sovereign" || lower === "enterprise") return "dedicated_sovereign";
  if (lower === "canary_sandbox") return "canary_sandbox";
  if (lower === "oss" || lower === "self_hosted") return "oss";
  return "builder_pro";
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
      "Instant 1-click upgrade to Pro or Team Plus",
    ],
    limits: {
      maxProjects: 1,
      eventsPerMonth: 100_000,
      retentionDays: 14,
    },
    cloudOnly: false,
  },
  {
    id: "builder_pro",
    name: "Cloud Pro",
    price: "$49",
    priceMonthly: "$49",
    priceAnnual: "$39",
    period: "/ mo",
    tierCode: "pro",
    description: "Seed startups & small product teams needing predictable zero-maintenance cloud with $0 overage guarantee.",
    features: [
      "500,000 events / mo included",
      "$0 overage guarantee (Spike Valve protection)",
      "Unlimited team seats",
      "Up to 5 projects",
      "30-day event retention",
      "Full Source Map demangling + epure-mcp",
      "Slack, Discord, Telegram & Webhook alerts",
    ],
    limits: {
      maxProjects: 5,
      eventsPerMonth: 500_000,
      retentionDays: 30,
    },
    highlighted: false,
    cloudOnly: true,
  },
  {
    id: "multi_app_studio",
    name: "Cloud Team Plus",
    price: "$99",
    priceMonthly: "$99",
    priceAnnual: "$79",
    period: "/ mo",
    tierCode: "team_plus",
    description: "Fast-moving funded startups (5–30 engineers) with active release pipelines.",
    features: [
      "2,500,000 events / mo included",
      "$0 overage guarantee (Spike Valve protection)",
      "Unlimited projects & unlimited seats",
      "90-day event retention",
      "Two-way GitHub & Linear Issue Sync",
      "Release commit tracking & regression alerts",
      "Unlimited Cron / Heartbeat monitors",
      "Priority email & Slack support",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: 2_500_000,
      retentionDays: 90,
    },
    highlighted: true,
    cloudOnly: true,
  },
  {
    id: "boutique_agency",
    name: "Cloud Agency",
    price: "$249",
    priceMonthly: "$249",
    priceAnnual: "$199",
    period: "/ mo",
    tierCode: "agency",
    description: "Web/SaaS Dev Agencies & Fractional CTOs managing up to 25 isolated client apps.",
    features: [
      "Up to 25 isolated client workspaces (PG16 RLS)",
      "10,000,000 pooled events / mo",
      "Per-client Spike Valve (zero cross-contamination)",
      "White-label Automated Weekly Client Stability Reports",
      "Role-based client view-only access",
      "All Clients Health Matrix & fast ⌘K switching",
      "Priority dedicated agency channel",
    ],
    limits: {
      maxProjects: 25,
      eventsPerMonth: 10_000_000,
      retentionDays: 90,
    },
    cloudOnly: true,
  },
  {
    id: "dedicated_sovereign",
    name: "Dedicated Sovereign",
    price: "$399",
    priceMonthly: "$399",
    priceAnnual: "$399",
    period: "/ mo",
    tierCode: "dedicated",
    description: "Fintech, Healthtech, and EU GDPR-strict teams demanding dedicated isolation or BYOC.",
    features: [
      "Dedicated single-tenant VM (Frankfurt, Paris, US-East) or BYOC VPC",
      "25,000,000+ events / mo & 1-year retention",
      "Signed GDPR DPA & Custom PII Scrubbing Rules",
      "SAML/OIDC SSO & Enterprise Audit Logs",
      "99.9% Uptime SLA + Dedicated Shared Slack Channel",
    ],
    limits: {
      maxProjects: null,
      eventsPerMonth: 25_000_000,
      retentionDays: 365,
    },
    cloudOnly: true,
  },
];

export const CLOUD_PLANS = PLANS.filter((plan) => plan.cloudOnly);

export const CLOUD_UPGRADE_URL = "https://epure.sh/pricing";
