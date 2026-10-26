// src/components/kit/product-tour.tsx
import { driver, type Config, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export type ProductTourStep = DriveStep;

export interface ProductTourOptions extends Partial<Config> {
  steps: ProductTourStep[];
  onFinish?: () => void;
}

const TOUR_SEEN_PREFIX = "epure.product_tour_seen";

export function productTourStorageKey(userId?: string | null): string {
  return userId ? `${TOUR_SEEN_PREFIX}.${userId}` : TOUR_SEEN_PREFIX;
}

export function hasSeenProductTour(userId?: string | null): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(productTourStorageKey(userId)) === "1";
}

export function markProductTourSeen(userId?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(productTourStorageKey(userId), "1");
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Inbox triage first, then sidebar tabs (tight highlight, no stage padding).
 * Anchors: stable `data-tour` selectors only.
 */
export const EPURE_PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    element: '[data-tour="issues-feed-help"]',
    popover: {
      title: "Scan your inbox",
      description: "Unresolved exceptions land here, newest first.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="issues-feed-search"]',
    popover: {
      title: "Filter your queue",
      description:
        "Use All, Unresolved, and time window above; click search to add tokens like is:unresolved or level:error.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="issue-row-sample"]',
    waitForElement: 4000,
    skipMissingElement: true,
    disableActiveInteraction: true,
    popover: {
      title: "Triage from the list",
      description:
        "J / K move · Enter opens detail · R resolve · S snooze · I ignore · / focuses search.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="keyboard-hints"]',
    disableActiveInteraction: true,
    popover: {
      title: "Copy for Cursor",
      description:
        "Press C on a row for triage markdown. User Settings → Personal Tokens for epure-mcp in your editor.",
      side: "top",
      align: "end",
    },
  },
  {
    element: '[data-tour="nav-issues"]',
    disableActiveInteraction: true,
    popover: {
      title: "Issues",
      description: "Your triage inbox — open exceptions for this project, newest first.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-monitoring"]',
    disableActiveInteraction: true,
    popover: {
      title: "Monitoring",
      description: "Error rates, throughput, and health charts for the same project.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-alerts"]',
    disableActiveInteraction: true,
    popover: {
      title: "Alerts",
      description: "Notify Slack, email, Discord, or webhooks when issues spike or new ones appear.",
      side: "right",
      align: "start",
    },
  },
];

/**
 * Epure Product Tour wrapper around driver.js.
 * Popover chrome is styled via `.epure-tour-popover` in app.css (Calm Ledger tokens).
 */
export function startProductTour({ steps, onFinish, ...config }: ProductTourOptions) {
  let finished = false;
  const finishOnce = () => {
    if (finished) {
      return;
    }
    finished = true;
    onFinish?.();
  };

  const driverObj = driver({
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    animate: !prefersReducedMotion(),
    duration: prefersReducedMotion() ? 0 : 220,
    steps,
    overlayOpacity: 0.36,
    stagePadding: 0,
    stageRadius: 4,
    popoverOffset: 10,
    allowClose: true,
    allowKeyboardControl: true,
    overlayClickBehavior: "close",
    closeBtnLabel: "Close tour",
    prevBtnText: "Back",
    nextBtnText: "Next",
    doneBtnText: "Done",
    popoverClass: "epure-tour-popover epure-tour-popover--pointer",
    onDestroyStarted: (_el, _step, { driver: activeDriver }) => {
      activeDriver.destroy();
    },
    onDestroyed: () => {
      finishOnce();
    },
    ...config,
  });

  driverObj.drive();
  return driverObj;
}

/** @returns false if tour was skipped (already seen or preconditions missing). */
export function startEpureProductTour(
  onFinish?: () => void,
  userId?: string | null,
  options?: { force?: boolean },
): ReturnType<typeof startProductTour> | false {
  if (!options?.force && hasSeenProductTour(userId)) {
    return false;
  }
  return startProductTour({
    steps: EPURE_PRODUCT_TOUR_STEPS,
    onFinish: () => {
      markProductTourSeen(userId);
      onFinish?.();
    },
  });
}

/**
 * Auto-start only when the feed has at least one issue (empty inbox → setup, not tour).
 */
export function tryAutoStartEpureProductTour(
  userId: string | undefined,
  ready: boolean,
): ReturnType<typeof startProductTour> | false {
  if (!ready || !userId || hasSeenProductTour(userId)) {
    return false;
  }
  return startEpureProductTour(undefined, userId);
}

/** @deprecated Use startEpureProductTour */
export const startAcmeProductTour = startEpureProductTour;

/** @deprecated Use EPURE_PRODUCT_TOUR_STEPS */
export const ACME_PRODUCT_TOUR_STEPS = EPURE_PRODUCT_TOUR_STEPS;
