// src/components/kit/product-tour.tsx
import {
  driver,
  type Config,
  type DriveStep,
  type Driver,
  type DriverHook,
} from "driver.js";
import "driver.js/dist/driver.css";
import { projectPath } from "@/lib/paths";

export type ProductTourStep = DriveStep;

export interface ProductTourOptions extends Partial<Config> {
  steps: ProductTourStep[];
  onFinish?: () => void;
}

const TOUR_SEEN_PREFIX = "epure.product_tour_seen";

/** Active driver instance — setup / dialogs must be able to dismiss the overlay. */
let activeTourDriver: Driver | null = null;

/** Tear down any running tour and clear leftover body locks. */
export function stopProductTour() {
  if (typeof document !== "undefined") {
    document.body.classList.remove(
      "driver-active",
      "driver-fade",
      "driver-simple",
      "driver-no-scroll",
    );
    document.body.style.removeProperty("--driver-animation-duration");
  }
  const current = activeTourDriver;
  activeTourDriver = null;
  if (current?.isActive()) {
    current.destroy();
  }
}

export function isProductTourActive(): boolean {
  return Boolean(activeTourDriver?.isActive());
}

/** Keep SVG cutout flush to the target’s box + border-radius. */
function syncStageToElement(el: Element | undefined, activeDriver: Driver) {
  if (!el || !(el instanceof HTMLElement)) {
    return;
  }
  const style = window.getComputedStyle(el);
  const radii = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].map((value) => {
    const px = parseFloat(value);
    return Number.isFinite(px) ? px : 0;
  });
  const radius = Math.max(0, Math.round(Math.max(...radii)));
  el.style.setProperty("--epure-tour-radius", `${radius}px`);
  activeDriver.setConfig({
    ...activeDriver.getConfig(),
    stagePadding: 0,
    stageRadius: radius,
  });
  activeDriver.refresh();
}

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

function waitForSelector(
  selector: string,
  timeoutMs = 5000,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const tick = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el || Date.now() - started >= timeoutMs) {
        window.clearInterval(tick);
        resolve(el);
      }
    }, 50);
  });
}

async function goAndHighlight(
  navigate: (to: string) => void,
  to: string,
  selector: string,
  activeDriver: Driver,
) {
  navigate(to);
  await waitForSelector(selector, 5000);
  // Let the route paint before measuring the stage.
  await new Promise((r) => window.setTimeout(r, prefersReducedMotion() ? 0 : 140));
  activeDriver.moveNext();
}

export type EpureProductTourContext = {
  projectId: string;
  navigate: (to: string) => void;
};

/**
 * First-login tour: projects → project dashboard → key tabs (≤8 steps).
 * Anchors target the visible component roots (tight cutout).
 */
export function buildEpureProductTourSteps(
  ctx: EpureProductTourContext,
): ProductTourStep[] {
  const { projectId, navigate } = ctx;
  const dashboard = projectPath(projectId, "dashboard");
  const issues = projectPath(projectId, "issues");

  return [
    {
      element: '[data-tour="projects-gallery"]',
      popover: {
        title: "Your projects",
        description: "Every app you monitor lives here. Pick one to go deep.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="project-card-sample"]',
      waitForElement: 4000,
      skipMissingElement: true,
      popover: {
        title: "Open a project",
        description: "Start with the sample: real telemetry, zero SDK setup.",
        side: "right",
        align: "start",
        onNextClick: ((_el, _step, { driver: activeDriver }) => {
          void goAndHighlight(
            navigate,
            dashboard,
            '[data-tour="nav-monitoring"]',
            activeDriver,
          );
        }) satisfies DriverHook,
      },
    },
    {
      element: '[data-tour="nav-monitoring"]',
      waitForElement: 5000,
      onHighlightStarted: ((_el, _step, { driver: activeDriver }) => {
        if (document.querySelector('[data-tour="nav-monitoring"]')) {
          return;
        }
        navigate(dashboard);
        void waitForSelector('[data-tour="nav-monitoring"]', 5000).then(() => {
          activeDriver.refresh();
        });
      }) satisfies DriverHook,
      popover: {
        title: "Dashboard",
        description: "Error pulse at a glance. Catch spikes before they escalate.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="nav-issues"]',
      popover: {
        title: "Issues",
        description: "Your triage inbox. Unresolved first: clear signal, not noise.",
        side: "right",
        align: "start",
        onNextClick: ((_el, _step, { driver: activeDriver }) => {
          void goAndHighlight(
            navigate,
            issues,
            '[data-tour="issues-feed-search"]',
            activeDriver,
          );
        }) satisfies DriverHook,
      },
    },
    {
      element: '[data-tour="issues-feed-search"]',
      waitForElement: 4000,
      skipMissingElement: true,
      popover: {
        title: "Triage fast",
        description: "Filter, then j/k through rows. Enter opens. R resolves.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="nav-alerts"]',
      popover: {
        title: "Alerts",
        description: "Slack, email, Discord when new issues or spikes hit.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="nav-releases"]',
      popover: {
        title: "Releases",
        description: "Tag deploys. Pin regressions to the ship that caused them.",
        side: "right",
        align: "start",
      },
    },
    {
      element: '[data-tour="command-palette-trigger"]',
      popover: {
        title: "Jump with ⌘K",
        description: "Projects, issues, settings: anywhere, no sidebar hunting.",
        side: "bottom",
        align: "start",
      },
    },
  ];
}

/** Static fallback steps (design-kit / legacy callers without navigate). */
export const EPURE_PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    element: '[data-tour="projects-gallery"]',
    popover: {
      title: "Your projects",
      description: "Every app you monitor lives here. Pick one to go deep.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-monitoring"]',
    skipMissingElement: true,
    popover: {
      title: "Dashboard",
      description: "Error pulse at a glance. Catch spikes before they escalate.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-issues"]',
    popover: {
      title: "Issues",
      description: "Your triage inbox. Unresolved first: clear signal, not noise.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="issues-feed-search"]',
    skipMissingElement: true,
    popover: {
      title: "Triage fast",
      description: "Filter, then j/k through rows. Enter opens. R resolves.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-alerts"]',
    popover: {
      title: "Alerts",
      description: "Slack, email, Discord when new issues or spikes hit.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-releases"]',
    popover: {
      title: "Releases",
      description: "Tag deploys. Pin regressions to the ship that caused them.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="command-palette-trigger"]',
    popover: {
      title: "Jump with ⌘K",
      description: "Projects, issues, settings: anywhere, no sidebar hunting.",
      side: "bottom",
      align: "start",
    },
  },
];

/**
 * Epure Product Tour wrapper around driver.js.
 * Soft faded focus via `.epure-tour-*` styles; cutout synced to element bounds.
 */
export function startProductTour({ steps, onFinish, ...config }: ProductTourOptions) {
  stopProductTour();

  let finished = false;
  const finishOnce = () => {
    if (finished) {
      return;
    }
    finished = true;
    if (activeTourDriver === driverObj) {
      activeTourDriver = null;
    }
    onFinish?.();
  };

  const userOnHighlighted = config.onHighlighted;
  const userOnHighlightStarted = config.onHighlightStarted;

  const driverObj = driver({
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    animate: !prefersReducedMotion(),
    duration: prefersReducedMotion() ? 0 : 220,
    steps,
    overlayOpacity: 0.42,
    overlayColor: "rgb(12, 12, 14)",
    stagePadding: 0,
    stageRadius: 8,
    popoverOffset: 12,
    allowClose: true,
    allowKeyboardControl: true,
    overlayClickBehavior: "close",
    closeBtnLabel: "Close tour",
    prevBtnText: "Back",
    nextBtnText: "Next",
    doneBtnText: "Got it",
    popoverClass: "epure-tour-popover epure-tour-popover--pointer",
    onDestroyStarted: (_el, _step, { driver: activeDriver }) => {
      activeDriver.destroy();
    },
    onDestroyed: () => {
      finishOnce();
    },
    ...config,
    onHighlightStarted: (el, step, opts) => {
      userOnHighlightStarted?.(el, step, opts);
    },
    onHighlighted: (el, step, opts) => {
      // Stage SVG exists here — hug the component’s box + border-radius.
      syncStageToElement(el, opts.driver);
      userOnHighlighted?.(el, step, opts);
    },
  });

  activeTourDriver = driverObj;
  driverObj.drive();
  return driverObj;
}

export type StartEpureProductTourOptions = {
  force?: boolean;
  projectId?: string | null;
  navigate?: (to: string) => void;
};

/** @returns false if tour was skipped (already seen or preconditions missing). */
export function startEpureProductTour(
  onFinish?: () => void,
  userId?: string | null,
  options?: StartEpureProductTourOptions,
): ReturnType<typeof startProductTour> | false {
  if (!options?.force && hasSeenProductTour(userId)) {
    return false;
  }

  const projectId = options?.projectId ?? null;
  const navigate = options?.navigate;
  const steps =
    projectId && navigate
      ? buildEpureProductTourSteps({ projectId, navigate })
      : EPURE_PRODUCT_TOUR_STEPS;

  return startProductTour({
    steps,
    onFinish: () => {
      markProductTourSeen(userId);
      onFinish?.();
    },
  });
}

/**
 * Auto-start on first login once projects are ready and a tour target exists.
 */
export function tryAutoStartEpureProductTour(
  userId: string | undefined,
  ready: boolean,
  options?: Omit<StartEpureProductTourOptions, "force">,
): ReturnType<typeof startProductTour> | false {
  if (!ready || !userId || hasSeenProductTour(userId)) {
    return false;
  }
  if (!options?.projectId || !options?.navigate) {
    return false;
  }
  return startEpureProductTour(undefined, userId, options);
}

/** @deprecated Use startEpureProductTour */
export const startAcmeProductTour = startEpureProductTour;

/** @deprecated Use EPURE_PRODUCT_TOUR_STEPS */
export const ACME_PRODUCT_TOUR_STEPS = EPURE_PRODUCT_TOUR_STEPS;
