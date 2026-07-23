/**
 * Two-proportion significance test for run-to-run rate changes. Keeps
 * "improved" from meaning noise.
 */

/** Standard normal CDF via the error function (exact to ~1e-7). */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Abramowitz-Stegun 7.1.26 error-function approximation. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function twoProportionPValue(k1: number, n1: number, k2: number, n2: number): number {
  if (n1 <= 0 || n2 <= 0) return 1;
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const pooled = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = (p2 - p1) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}

export function isSignificantChange(k1: number, n1: number, k2: number, n2: number): boolean {
  return twoProportionPValue(k1, n1, k2, n2) < 0.05;
}
