/**
 * Cost governance.
 *
 * Margin is measured or imaginary. Every run carries hard limits; a runaway
 * agent is the one failure mode that ends an agency.
 */

import { addCost, emptyCost } from "@/lib/agents/types";
import type { ClientCostBudget, CostRecord, RunBudget } from "@/lib/agents/types";

export function budgetFromClient(budget: ClientCostBudget): RunBudget {
  return {
    maxTokens: budget.maxTokensPerRun,
    maxApiCalls: budget.maxApiCallsPerRun,
    maxMs: budget.maxMsPerRun,
  };
}

export function remaining(budget: RunBudget, spent: CostRecord): CostRecord {
  return {
    tokens: Math.max(0, budget.maxTokens - spent.tokens),
    apiCalls: Math.max(0, budget.maxApiCalls - spent.apiCalls),
    ms: Math.max(0, budget.maxMs - spent.ms),
  };
}

export function canAfford(budget: RunBudget, spent: CostRecord): { ok: boolean; reason: string } {
  const left = remaining(budget, spent);
  if (left.tokens <= 0) return { ok: false, reason: "token budget exhausted" };
  if (left.apiCalls <= 0) return { ok: false, reason: "api call budget exhausted" };
  if (left.ms <= 0) return { ok: false, reason: "time budget exhausted" };
  return { ok: true, reason: "within budget" };
}

export function costToServe(steps: { cost: CostRecord }[]): CostRecord {
  return steps.reduce((total, step) => addCost(total, step.cost), emptyCost());
}
