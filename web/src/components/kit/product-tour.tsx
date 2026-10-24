// src/components/kit/product-tour.tsx
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

export type ProductTourStep = DriveStep;

export interface ProductTourOptions extends Partial<Config> {
  steps: ProductTourStep[];
  onFinish?: () => void;
}

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
