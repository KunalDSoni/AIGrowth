/**
 * Agent runtime — shared domain types.
 *
 * No type here may encode industry knowledge. Vertical specifics belong to the
 * VerticalModel record, which agents read through RunContext.
 */

export type AgentName =
  | "observer"
  | "onboarding"
  | "diagnosis"
  | "strategist"
  | "packager"
  | "compliance"
  | "reporter";

export type RunStatus = "pending" | "running" | "blocked" | "done" | "failed";
export type StepStatus = "pending" | "running" | "ok" | "skipped" | "failed" | "needs_input";
export type RiskTier = "low" | "medium" | "high";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "superseded";
export type ProposalKind = "create" | "update" | "retire";
export type ProposalTargetType =
  | "asset"
  | "pack"
  | "outreach"
  | "page-change"
  | "vertical-model"
  | "observation";

export interface CostRecord {
  tokens: number;
  apiCalls: number;
  ms: number;
}

export function emptyCost(): CostRecord {
  return { tokens: 0, apiCalls: 0, ms: 0 };
}

export function addCost(a: CostRecord, b: CostRecord): CostRecord {
  return {
    tokens: a.tokens + b.tokens,
    apiCalls: a.apiCalls + b.apiCalls,
    ms: a.ms + b.ms,
  };
}

export interface ProposalDraft {
  kind: ProposalKind;
  target: { type: ProposalTargetType; id?: string };
  payload: unknown;
  rationale: string;
  evidenceIds: string[];
  riskTier: RiskTier;
  /** Stable identity for a finding. Rediscovery updates rather than duplicates. */
  dedupeKey: string;
  estimatedImpact: string;
  effortHours: number;
  costToProduce: number;
}

export interface Proposal extends ProposalDraft {
  id: string;
  clientId: string;
  runId: string;
  agentName: AgentName;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StepResult {
  status: "ok" | "skipped" | "failed" | "needs_input";
  proposals: ProposalDraft[];
  cost: CostRecord;
  notes: string[];
}

export interface RunBudget {
  maxMs: number;
  maxTokens: number;
  maxApiCalls: number;
}

export interface Run {
  id: string;
  clientId: string;
  status: RunStatus;
  trigger: "cron" | "manual";
  startedAt: string;
  finishedAt?: string;
  budget: RunBudget;
  spent: CostRecord;
}

export interface RunStep {
  id: string;
  runId: string;
  agentName: AgentName;
  ordinal: number;
  status: StepStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  cost: CostRecord;
  error?: string;
  notes: string[];
}

export interface ClientCostBudget {
  maxTokensPerRun: number;
  maxApiCallsPerRun: number;
  maxMsPerRun: number;
}

export interface ClientRecord {
  id: string;
  domain: string;
  brand: string;
  cadenceHours: number;
  nextRunAt?: string;
  leaseUntil?: string;
  costBudget: ClientCostBudget;
}

export interface ProposalFilter {
  clientId?: string;
  runId?: string;
  status?: ProposalStatus;
}
