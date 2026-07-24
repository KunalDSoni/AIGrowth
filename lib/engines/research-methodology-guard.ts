/**
 * PRE-1 — Methodology Guard (Proprietary Research Engine, Frontier 3).
 *
 * The make-or-break integrity core. A fabricated or underpowered statistic is
 * reputational poison that LLMs amplify, so this engine defines the method
 * *before* results (pre-registration style), runs sample-size and
 * representativeness checks, and refuses to let a claim ship that the data
 * cannot defend.
 *
 * Every threshold is a documented directional constant (mirrors
 * `scoring-constants.ts`) — never a hidden magic number — because the verdict it
 * produces gates whether the account publishes a public statistic under its own
 * name.
 *
 * Honesty non-negotiables enforced here:
 *  - thin data → "directional" or "insufficient", never spun to "supported";
 *  - a single dominant source cannot masquerade as a representative finding;
 *  - a pre-declared segment with too few observations cannot be reported as its
 *    own finding;
 *  - a claim the data cannot support is blocked (`publishable: false`).
 */

/** How strongly the data backs the intended claim. Ordered weakest → strongest. */
export type ClaimStrength = "insufficient" | "directional" | "supported";

export const STRENGTH_ORDER: ClaimStrength[] = ["insufficient", "directional", "supported"];

/** The weaker of two claim strengths — a single disqualifying factor caps the claim. */
export function weakestStrength(a: ClaimStrength, b: ClaimStrength): ClaimStrength {
  return STRENGTH_ORDER.indexOf(a) <= STRENGTH_ORDER.indexOf(b) ? a : b;
}

/**
 * A pre-registration locks the intended study *before* any result is computed —
 * the discipline that stops p-hacking toward a nicer number.
 */
export interface PreRegistration {
  /** The claim the study intends to make, stated before results. */
  hypothesis: string;
  /** How the metric is measured (plain English). */
  method: string;
  /** What is being measured. */
  metric: string;
  /** Pre-committed sample size required to call the claim "supported". */
  minSampleSize: number;
  /** Segments the study pre-declared it would break the finding down by. */
  segments?: string[];
  /** ISO timestamp the registration was locked. */
  registeredAt: string;
}

/** The shape of the collected data, independent of its contents. */
export interface SampleProfile {
  /** Total observations in the dataset. */
  n: number;
  /** Observations per pre-declared segment (for coverage checks). */
  segmentCounts?: Record<string, number>;
  /** Observations per originating source (for single-source-dominance checks). */
  sourceCounts?: Record<string, number>;
}

export interface MethodologyCheck {
  id: string;
  label: string;
  passed: boolean;
  /** The strongest strength this check will still allow (its cap). */
  cap: ClaimStrength;
  detail: string;
}

export interface MethodologyVerdict {
  strength: ClaimStrength;
  /** A claim is publishable unless the data is outright insufficient. */
  publishable: boolean;
  checks: MethodologyCheck[];
  /** Plain-English methodology statement for the published appendix. */
  statement: string;
  /** Human-readable reasons the claim was capped or blocked. */
  blockedReasons: string[];
}

/**
 * Documented thresholds. Directional priors chosen conservatively — the cost of a
 * wrongly-published statistic is far higher than the cost of labelling a real one
 * "directional".
 */
export const METHODOLOGY_GUARD = {
  /** Below this total n, the data cannot support any public claim. */
  DIRECTIONAL_MIN_N: 12,
  /** One source contributing more than this share confounds the finding → cap at directional. */
  SOFT_SOURCE_DOMINANCE: 0.7,
  /** One source contributing more than this share means the "finding" is really about that source → insufficient. */
  HARD_SOURCE_DOMINANCE: 0.9,
  /** A pre-declared segment reported as its own finding needs at least this many observations. */
  MIN_SEGMENT_N: 5,
} as const;

export const METHODOLOGY_GUARD_VERSION = 1;

function preRegistrationValid(reg: PreRegistration): boolean {
  return (
    reg.hypothesis.trim().length > 0 &&
    reg.method.trim().length > 0 &&
    reg.metric.trim().length > 0 &&
    Number.isFinite(reg.minSampleSize) &&
    reg.minSampleSize > 0 &&
    reg.registeredAt.trim().length > 0
  );
}

function maxSourceShare(sample: SampleProfile): { share: number; source: string } | null {
  const counts = sample.sourceCounts;
  if (!counts || sample.n <= 0) return null;
  let top = { share: 0, source: "" };
  for (const [source, count] of Object.entries(counts)) {
    const share = count / sample.n;
    if (share > top.share) top = { share, source };
  }
  return top.source ? top : null;
}

/**
 * Evaluate whether the pre-registered study can be published, and at what
 * strength. The verdict is the *weakest* strength any check allows — a single
 * disqualifying check caps the whole claim.
 */
export function evaluateMethodology(
  reg: PreRegistration,
  sample: SampleProfile,
): MethodologyVerdict {
  const checks: MethodologyCheck[] = [];
  const blockedReasons: string[] = [];

  // 1. Pre-registration integrity — a study without a locked, complete plan is
  //    not a study; it is a result in search of a hypothesis.
  const regValid = preRegistrationValid(reg);
  checks.push({
    id: "pre-registration",
    label: "Method registered before results",
    passed: regValid,
    cap: regValid ? "supported" : "insufficient",
    detail: regValid
      ? `Locked ${reg.registeredAt}: "${reg.hypothesis}" measured via ${reg.metric}.`
      : "Pre-registration is missing a hypothesis, method, metric, sample target, or lock time.",
  });
  if (!regValid) blockedReasons.push("The study was not fully pre-registered before analysis.");

  // 2. Sample size — the account's committed minimum is the bar for "supported".
  const effectiveMin = Math.max(reg.minSampleSize, METHODOLOGY_GUARD.DIRECTIONAL_MIN_N);
  let sizeCap: ClaimStrength;
  let sizeDetail: string;
  if (sample.n >= effectiveMin) {
    sizeCap = "supported";
    sizeDetail = `n=${sample.n} meets the pre-committed minimum of ${reg.minSampleSize}.`;
  } else if (sample.n >= METHODOLOGY_GUARD.DIRECTIONAL_MIN_N) {
    sizeCap = "directional";
    sizeDetail = `n=${sample.n} is below the pre-committed minimum of ${reg.minSampleSize}; directional only.`;
    blockedReasons.push(
      `Sample of ${sample.n} is under the pre-committed ${reg.minSampleSize}; reported as directional.`,
    );
  } else {
    sizeCap = "insufficient";
    sizeDetail = `n=${sample.n} is below the floor of ${METHODOLOGY_GUARD.DIRECTIONAL_MIN_N} for any public claim.`;
    blockedReasons.push(`Sample of ${sample.n} is too small to support any public claim.`);
  }
  checks.push({
    id: "sample-size",
    label: "Sufficient sample size",
    passed: sizeCap === "supported",
    cap: sizeCap,
    detail: sizeDetail,
  });

  // 3. Single-source dominance — a "finding" driven by one source is that
  //    source's finding, not the market's.
  const top = maxSourceShare(sample);
  if (top) {
    const pct = Math.round(top.share * 100);
    let domCap: ClaimStrength;
    let domDetail: string;
    if (top.share > METHODOLOGY_GUARD.HARD_SOURCE_DOMINANCE) {
      domCap = "insufficient";
      domDetail = `${pct}% of observations come from "${top.source}"; the finding is about that source, not the market.`;
      blockedReasons.push(`One source ("${top.source}") supplies ${pct}% of the data — not representative.`);
    } else if (top.share > METHODOLOGY_GUARD.SOFT_SOURCE_DOMINANCE) {
      domCap = "directional";
      domDetail = `${pct}% of observations come from "${top.source}"; representativeness is limited.`;
      blockedReasons.push(`"${top.source}" contributes ${pct}% of the data; reported as directional.`);
    } else {
      domCap = "supported";
      domDetail = `No single source exceeds ${Math.round(METHODOLOGY_GUARD.SOFT_SOURCE_DOMINANCE * 100)}% of observations (top: "${top.source}" at ${pct}%).`;
    }
    checks.push({
      id: "source-representativeness",
      label: "No single-source dominance",
      passed: domCap === "supported",
      cap: domCap,
      detail: domDetail,
    });
  }

  // 4. Segment coverage — a pre-declared breakdown needs real observations in
  //    each cell, or the breakdown cannot be reported.
  const declaredSegments = reg.segments ?? [];
  if (declaredSegments.length > 0) {
    const thin: string[] = [];
    for (const seg of declaredSegments) {
      const c = sample.segmentCounts?.[seg] ?? 0;
      if (c < METHODOLOGY_GUARD.MIN_SEGMENT_N) thin.push(`${seg} (n=${c})`);
    }
    const passed = thin.length === 0;
    checks.push({
      id: "segment-coverage",
      label: "Pre-declared segments have coverage",
      passed,
      cap: passed ? "supported" : "directional",
      detail: passed
        ? `All ${declaredSegments.length} pre-declared segments have at least ${METHODOLOGY_GUARD.MIN_SEGMENT_N} observations.`
        : `Under-covered segments: ${thin.join(", ")}. Breakdown reported as directional.`,
    });
    if (!passed) {
      blockedReasons.push(`Segments below ${METHODOLOGY_GUARD.MIN_SEGMENT_N} observations: ${thin.join(", ")}.`);
    }
  }

  const strength = checks.reduce<ClaimStrength>((acc, c) => weakestStrength(acc, c.cap), "supported");
  const publishable = strength !== "insufficient";

  return {
    strength,
    publishable,
    checks,
    statement: buildStatement(reg, sample, strength),
    blockedReasons,
  };
}

/** Plain-English methodology statement destined for the published appendix. */
function buildStatement(reg: PreRegistration, sample: SampleProfile, strength: ClaimStrength): string {
  if (!preRegistrationValid(reg)) {
    return "This study is not publishable: its method was not fully registered before analysis.";
  }
  if (strength === "insufficient") {
    return `Based on ${sample.n} observations measuring ${reg.metric}, the data is insufficient to support the claim "${reg.hypothesis}". We will not publish this statistic.`;
  }
  const qualifier = strength === "supported" ? "supports" : "directionally indicates";
  return `Method (pre-registered ${reg.registeredAt}): ${reg.method}. Across ${sample.n} observations measuring ${reg.metric}, the data ${qualifier} the finding. Strength: ${strength}.`;
}
