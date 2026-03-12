/** Compact count for feed columns (e.g. 462k, 1.2M). */
export function formatCompactCount(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  if (value < 1_000_000) {
    const rounded = value / 1000;
    return rounded >= 100 ? `${Math.round(rounded)}k` : `${rounded.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const rounded = value / 1_000_000;
  return rounded >= 100 ? `${Math.round(rounded)}M` : `${rounded.toFixed(1).replace(/\.0$/, "")}M`;
}
