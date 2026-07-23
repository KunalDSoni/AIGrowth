/**
 * Thompson Sampling multi-armed bandit (Beta–Bernoulli).
 * θᵢ ~ Beta(αᵢ, βᵢ); select argmax θᵢ; convert → α+1; fail → β+1.
 */

export interface BanditArm {
  id: string;
  label: string;
  alpha: number;
  beta: number;
  /** Payload returned to the client (e.g. variant key / headline). */
  payload: Record<string, unknown>;
}

export interface BanditExperiment {
  id: string;
  name: string;
  arms: BanditArm[];
  /** visitorId → armId sticky assignments */
  assignments: Record<string, string>;
  /** Counts of times each arm was served (for traffic share). */
  impressions: Record<string, number>;
  updatedAt: string;
}

export interface SelectResult {
  experimentId: string;
  armId: string;
  label: string;
  payload: Record<string, unknown>;
  sticky: boolean;
  samples: Record<string, number>;
}

function clampPositive(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Marsaglia–Tsang gamma sampler for shape >= 1; boost for shape < 1. */
export function sampleGamma(shape: number, rng: () => number = Math.random): number {
  const a = clampPositive(shape);
  if (a < 1) {
    const boosted = sampleGamma(a + 1, rng);
    return boosted * Math.pow(rng(), 1 / a);
  }
  const d = a - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = sampleStandardNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleStandardNormal(rng: () => number): number {
  // Box–Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Draw θ ~ Beta(α, β) via Gamma ratio. */
export function sampleBeta(alpha: number, beta: number, rng: () => number = Math.random): number {
  const x = sampleGamma(clampPositive(alpha), rng);
  const y = sampleGamma(clampPositive(beta), rng);
  const sum = x + y;
  return sum === 0 ? 0.5 : x / sum;
}

export function createExperiment(input: {
  id: string;
  name: string;
  arms: Array<{ id: string; label: string; payload?: Record<string, unknown> }>;
}): BanditExperiment {
  if (input.arms.length < 2) throw new Error("A bandit experiment needs at least two arms.");
  const impressions: Record<string, number> = {};
  const arms: BanditArm[] = input.arms.map((arm) => {
    impressions[arm.id] = 0;
    return {
      id: arm.id,
      label: arm.label,
      alpha: 1,
      beta: 1,
      payload: arm.payload ?? {},
    };
  });
  return {
    id: input.id,
    name: input.name,
    arms,
    assignments: {},
    impressions,
    updatedAt: new Date().toISOString(),
  };
}

export function selectArm(
  experiment: BanditExperiment,
  visitorId: string,
  rng: () => number = Math.random,
): SelectResult {
  const existing = experiment.assignments[visitorId];
  if (existing) {
    const arm = experiment.arms.find((a) => a.id === existing);
    if (arm) {
      experiment.impressions[arm.id] = (experiment.impressions[arm.id] ?? 0) + 1;
      experiment.updatedAt = new Date().toISOString();
      return {
        experimentId: experiment.id,
        armId: arm.id,
        label: arm.label,
        payload: arm.payload,
        sticky: true,
        samples: Object.fromEntries(experiment.arms.map((a) => [a.id, Number.NaN])),
      };
    }
  }

  // Small ε-greedy floor so extreme posteriors still explore (~5% of new visitors).
  const EXPLORATION_EPSILON = 0.05;
  if (rng() < EXPLORATION_EPSILON) {
    const arm = experiment.arms[Math.floor(rng() * experiment.arms.length)] ?? experiment.arms[0];
    experiment.assignments[visitorId] = arm.id;
    experiment.impressions[arm.id] = (experiment.impressions[arm.id] ?? 0) + 1;
    experiment.updatedAt = new Date().toISOString();
    return {
      experimentId: experiment.id,
      armId: arm.id,
      label: arm.label,
      payload: arm.payload,
      sticky: false,
      samples: Object.fromEntries(experiment.arms.map((a) => [a.id, Number.NaN])),
    };
  }

  const samples: Record<string, number> = {};
  let best = experiment.arms[0];
  let bestSample = -1;
  for (const arm of experiment.arms) {
    const theta = sampleBeta(arm.alpha, arm.beta, rng);
    samples[arm.id] = theta;
    if (theta > bestSample) {
      bestSample = theta;
      best = arm;
    }
  }

  experiment.assignments[visitorId] = best.id;
  experiment.impressions[best.id] = (experiment.impressions[best.id] ?? 0) + 1;
  experiment.updatedAt = new Date().toISOString();

  return {
    experimentId: experiment.id,
    armId: best.id,
    label: best.label,
    payload: best.payload,
    sticky: false,
    samples,
  };
}

export function recordOutcome(experiment: BanditExperiment, armId: string, converted: boolean) {
  const arm = experiment.arms.find((a) => a.id === armId);
  if (!arm) throw new Error(`Unknown arm: ${armId}`);
  if (converted) arm.alpha += 1;
  else arm.beta += 1;
  experiment.updatedAt = new Date().toISOString();
  return arm;
}

export function trafficShares(experiment: BanditExperiment): Record<string, number> {
  const total = Object.values(experiment.impressions).reduce((s, n) => s + n, 0);
  const shares: Record<string, number> = {};
  for (const arm of experiment.arms) {
    const count = experiment.impressions[arm.id] ?? 0;
    shares[arm.id] = total === 0 ? 1 / experiment.arms.length : count / total;
  }
  return shares;
}

/** Posterior mean α/(α+β) — useful for dashboards. */
export function posteriorMeans(experiment: BanditExperiment): Record<string, number> {
  return Object.fromEntries(
    experiment.arms.map((arm) => [arm.id, arm.alpha / (arm.alpha + arm.beta)]),
  );
}
