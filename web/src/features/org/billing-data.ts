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
    description: "Apache 2.0 — run epure on your own infrastructure.",
    features: [
      "Full core product",
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
    description: "Managed hosting for indie teams and early startups.",
    features: [
      "200k errors included / month",
      "30-day retention",
      "Zero overage bills — soft sampling",
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

export interface BillingFaqItem {
  question: string;
  answer: string;
}

export const BILLING_FAQ: BillingFaqItem[] = [
  {
    question: "Is self-hosted really free?",
    answer:
      "Yes. The OSS build is Apache 2.0 with the full core product — no subscription, no usage billing, no crippleware. You pay only for your own server.",
  },
  {
    question: "What happens if I exceed my Cloud limit?",
    answer:
      "epure never sends overage invoices or shuts off your dashboard. Counts stay at 100%; raw payloads soft-sample. Upgrade when you need more included volume.",
  },
  {
    question: "Can I switch between Pro and Plus?",
    answer:
      "Yes. Upgrades apply immediately with prorated billing. Downgrades take effect at the end of your current period.",
  },
];

export const CLOUD_UPGRADE_URL = "https://epure.sh#plans";
