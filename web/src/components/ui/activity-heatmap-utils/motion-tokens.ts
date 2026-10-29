/** Motion presets are shared by the gallery and future registry consumers. */
export const motionTokens = {
  duration: {
    /** Small fades and nudges, the quietest step on the scale. */
    micro: 0.08,
    instant: 0.12,
    fast: 0.16,
    exit: 0.18,
    standard: 0.24,
    /** Shakes, draws, and settles that carry a little more weight than a fade. */
    moderate: 0.32,
    considered: 0.48,
  },
  /** Start offsets for choreography: a beat before the next part moves. For longer waits use the duration scale. */
  delay: { micro: 0.05, short: 0.08 },
  ease: {
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    standard: [0.22, 1, 0.36, 1],
    /** For elements that move while already on screen. */
    inOut: [0.65, 0, 0.35, 1],
  },
  spring: {
    responsive: { type: "spring", stiffness: 520, damping: 38 },
    gentle: { type: "spring", stiffness: 340, damping: 34 },
    /** Presses, toggles, thumbs, and small indicators. Settles fast with a hint of life. */
    snappy: { type: "spring", visualDuration: 0.26, bounce: 0.12 },
    /** Panels, height changes, and layout shifts. Critically damped, never overshoots. */
    smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
    /** Shape morphs, shared layout highlights, and width changes that follow new content. */
    morph: { type: "spring", visualDuration: 0.42, bounce: 0.16 },
    /** Things that land without bounce a little faster than panels: exits, glides, snap backs. */
    settle: { type: "spring", visualDuration: 0.32, bounce: 0 },
  },
  /** Stagger steps in seconds. Keep total stagger under roughly 0.4s. */
  stagger: { char: 0.016, word: 0.04, line: 0.08, item: 0.035 },
  /** Blur radii in px for text and content crossfades. Keep blur small and brief. */
  blur: { subtle: 2, soft: 4, text: 8 },
} as const;
