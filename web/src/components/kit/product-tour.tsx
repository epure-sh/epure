// src/components/kit/product-tour.tsx
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

export type ProductTourStep = DriveStep;

export interface ProductTourOptions extends Partial<Config> {
  steps: ProductTourStep[];
  onFinish?: () => void;
}

export const ACME_PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    element: '[data-tour="monitoring-nav"]',
    popover: {
      title: "1/4 · Peaceful Monitoring & Spike Valve",
      description:
        "Epure guarantees quiet, high-signal monitoring. The in-memory Spike Valve absorbs flood loops at 0 CPU overhead with a $0 overage guarantee.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-slot="filter-bar"]',
    popover: {
      title: "2/4 · Impact Scoring & Velocity Filters",
      description:
        "Filter by environment (production vs staging), toggle 3-day escalating surges, catch regressed errors, and triage by critical impact scores.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-slot="issue-feed-list"]',
    popover: {
      title: "3/4 · Muscle Memory Hotkeys & AI Agent Fixes",
      description:
        "Navigate with J/K, select with X, resolve with R, or hit C to ask Claude Code or Cursor to produce an instant bugfix reproduction snippet.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="project-switcher"]',
    popover: {
      title: "4/4 · Connect Your Real Apps in 30 Seconds",
      description:
        "Epure is 100% wire-compatible with your existing Sentry SDKs. Swap your DSN or connect epure-mcp for continuous background triage.",
      side: "bottom",
      align: "start",
    },
  },
];

/**
 * Epure Product Tour wrapper around driver.js.
 * Enforces Layer 0 token styles across popover surfaces, buttons, and close actions.
 */
export function startProductTour({ steps, onFinish, ...config }: ProductTourOptions) {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    steps,
    onDestroyStarted: () => {
      driverObj.destroy();
      onFinish?.();
    },
    popoverClass: "epure-tour-popover",
    ...config,
  });

  driverObj.drive();
  return driverObj;
}

/**
 * Start the 4-step Acme spotlight product tour.
 * Keypress 'Esc' dismisses the tour anytime.
 */
export function startAcmeProductTour(onFinish?: () => void) {
  return startProductTour({
    steps: ACME_PRODUCT_TOUR_STEPS,
    onFinish,
  });
}
