export type PlanId =
  | "oss"
  | "builder_pro"
  | "multi_app_studio"
  | "boutique_agency"
  | "canary_sandbox";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string | null;
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
    id: "builder_pro",
    name: "Builder Pro",
    price: "$39",
    period: "/ mo ($29/mo Founding Lock)",
    description: "For solo founders and software makers. 1 Org, up to 3 Projects.",
    features: [
      "Up to 3 Projects / Apps",
      "30-day encrypted retention",
      "Zero-DB-hit DSN caching on edge",
      "Sub-600 token MCP (no $40/dev tax)",
      "Agentjacking prompt-injection defense",
      "Automated backups & zero maintenance",
    ],
    limits: {
      maxProjects: 3,
      eventsPerMonth: 250_000,
      retentionDays: 30,
    },
    highlighted: true,
    cloudOnly: true,
  },
  {
    id: "multi_app_studio",
    name: "Multi-App Studio",
    price: "$89",
    period: "/ mo",
    description: "For dev studios running multiple SaaS products under one flat bill.",
    features: [
      "Up to 15 isolated Projects / Apps",
      "Independent per-project Spike Valves",
      "90-day retention & historical telemetry",
      "Zero quota cross-contamination",
      "Unlimited team members & agent tokens",
      "Priority founder support",
    ],
    limits: {
      maxProjects: 15,
      eventsPerMonth: 2_000_000,
      retentionDays: 90,
    },
    cloudOnly: true,
  },
  {
    id: "boutique_agency",
    name: "Boutique Agency",
    price: "199€",
    period: "/ mo ($199/mo)",
    description: "For agencies reselling TMA monitoring at 80€–150€/mo/client margin.",
    features: [
      "Parent Agency managing up to 25 Workspaces",
      "Strict PostgreSQL 16 RLS tenant isolation",
      "Fast Cmd+K client workspace switcher",
      "Read-only Client Viewer invites",
      "Per-client Spike Valves & telemetry",
      "Dedicated agency Slack/Discord channel",
    ],
    limits: {
      maxProjects: 25,
      eventsPerMonth: 5_000_000,
      retentionDays: 90,
    },
    cloudOnly: true,
  },
];

export const CLOUD_PLANS = PLANS.filter((plan) => plan.cloudOnly);

export const CLOUD_UPGRADE_URL = "https://epure.sh/#pricing";
