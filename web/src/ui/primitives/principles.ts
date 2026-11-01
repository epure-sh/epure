// web/src/ui/primitives/principles.ts
// Polar Orbit governing design principles, product design rules, and developer voice guidelines.

export interface DesignPrinciple {
  index: string;
  name: string;
  lead: string;
  body: string;
}

/**
 * The three core principles that govern every design decision in Orbit.
 * Ordered strictly: when principles conflict, the earlier one takes precedence.
 */
export const ORBIT_CORE_PRINCIPLES: readonly DesignPrinciple[] = [
  {
    index: "01",
    name: "Design by subtraction",
    lead: "Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design.",
    body: "Orbit ships one spacing scale, a handful of radii, and a small set of semantic colors. The constraint is the feature. Fewer choices means fewer ways to drift, so every surface reads as one system.",
  },
  {
    index: "02",
    name: "Derived, not decorated",
    lead: "Every visual element should feel like it emerged from an underlying rule, not a designer's preference. Beauty is a byproduct of correctness.",
    body: "Polar does not have a visual personality in the conventional sense. It has a visual logic. The temptation to express, to decorate, to add warmth or character through aesthetics: we resist it. The character lives in the point of view, the copy, the product decisions. The design gets out of the way. Color resolves from light-dark(), spacing from a single scale, motion from physical curves.",
  },
  {
    index: "03",
    name: "Precision as respect",
    lead: "Our audience is technical. They pattern-match fast and trust slowly. Every pixel, every word, every interaction that is imprecise is a signal that we don't understand their world.",
    body: "Precision is not a quality standard. It is a form of respect. Box makes precision the default by removing arbitrary values: typed props take tokens, never raw pixels, so the easy path and the correct path are the same.",
  },
] as const;

/**
 * Product Design Rules applying the Orbit principles to telemetry & error tracking instruments.
 */
export const PRODUCT_DESIGN_PRINCIPLES = {
  dataIsTheDesign: {
    title: "Data is the design",
    description:
      "Numbers and telemetry are the primary content. UI chrome exists solely to make data legible, scannable, and trustworthy at a glance.",
  },
  densityWithClarity: {
    title: "Density with clarity",
    description:
      "Technical operators require high-density information. Clarity is achieved through typographic hierarchy, zero layout shift, and tabular-nums, never artificial progressive disclosure.",
  },
  zeroPolishDebt: {
    title: "Zero polish debt",
    description:
      "Empty states, error boundaries, and loading skeletons are primary states designed with the same precision as main views.",
  },
  speedAsDesignValue: {
    title: "Speed as a design value",
    description:
      "Zero layout shift, immediate pointer-down depression feedback, and instant keyboard shortcuts without animation lock.",
  },
  artifactPrinciple: {
    title: "The artifact principle",
    description:
      "Issue rows, alert cards, and code frames are shareable technical artifacts deserving typographic exactness and zero decorative noise.",
  },
} as const;

/**
 * Developer Voice Guidelines: How Epure sounds in UI, empty states, alerts, errors, and documentation.
 */
export const VOICE_GUIDELINES = {
  headline: "Write like a developer",
  rules: [
    "Lead with the thing. The first sentence must contain the most important information.",
    "Short sentences over long ones. If a sentence has more than two clauses, break it.",
    'Active voice, always. "Epure groups exceptions" not "Exceptions are grouped by Epure."',
    'Specificity over generality. "Bills per token" beats "flexible pricing."',
    "Omit needless words. Cut every word that is not earning its place.",
    "Do not explain what is obvious. Assuming intelligence is a form of respect.",
    "Humor is dry, never performed. Wit comes from precision and understatement.",
    "Consistency in terminology. Pick the exact word for a concept and use it every time.",
  ] as const,
} as const;
