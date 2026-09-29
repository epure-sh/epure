export type PlanId = "oss" | "pro" | "plus";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string | null;
  period: string | null;
  description: string;
  features: string[];
  limits: {
    eventsPerMonth: number | null;
    retentionDays: number | null;
  };
  highlighted?: boolean;
  cloudOnly?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "oss",
    name: "Self-hosted",
    price: "$0",
    period: null,
    description: "Apache 2.0. Run Epure on your own infrastructure.",
    features: [
      "Issues, stack traces, grouping, DSN ingest",
      "Unlimited projects & seats",
      "You manage Postgres & backups",
    ],
    limits: {
      eventsPerMonth: null,
      retentionDays: null,
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$24",
    period: "/ mo",
    description: "Managed hosting of the same binary. Pro $24. No overage invoice.",
    features: [
      "200k errors included / month",
      "30-day retention",
      "Zero overage bills, soft sampling",
      "TLS, backups, upgrades handled",
    ],
    limits: {
      eventsPerMonth: 200_000,
      retentionDays: 30,
    },
    cloudOnly: true,
  },
  {
    id: "plus",
    name: "Plus",
    price: "$79",
    period: "/ mo",
    description: "Higher volume and compliance for growing teams.",
    features: [
      "1.5M errors included / month",
      "90-day retention",
      "Audit logs & SSO (Plus)",
      "Dedicated support",
    ],
    limits: {
      eventsPerMonth: 1_500_000,
      retentionDays: 90,
    },
    highlighted: true,
    cloudOnly: true,
  },
];

export const CLOUD_PLANS = PLANS.filter((plan) => plan.cloudOnly);

/** Pricing + Cloud waitlist on the marketing site. */
export const CLOUD_UPGRADE_URL = "https://epure.sh#plans";
