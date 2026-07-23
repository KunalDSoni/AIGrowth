/**
 * PostgreSQL-backed RuntimeStore.
 *
 * Enum values are upper-cased at the boundary; the domain layer stays lower-case.
 */

import { getPrismaClient } from "@/lib/db/prisma";
import type { RuntimeStore } from "@/lib/agents/store";
import type {
  ClientRecord,
  Proposal,
  ProposalFilter,
  ProposalStatus,
  Run,
  RunStatus,
  RunStep,
  StepStatus,
} from "@/lib/agents/types";

type Row = Record<string, unknown>;

const up = (value: string) => value.toUpperCase().replace(/-/g, "_");
const down = (value: string) => value.toLowerCase().replace(/_/g, "-");

function toClient(row: Row): ClientRecord {
  return {
    id: row.id as string,
    domain: row.domain as string,
    brand: row.brand as string,
    cadenceHours: row.cadenceHours as number,
    nextRunAt: (row.nextRunAt as Date | null)?.toISOString(),
    leaseUntil: (row.leaseUntil as Date | null)?.toISOString(),
    costBudget: {
      maxTokensPerRun: row.maxTokensPerRun as number,
      maxApiCallsPerRun: row.maxApiCallsPerRun as number,
      maxMsPerRun: row.maxMsPerRun as number,
    },
  };
}

function toRun(row: Row): Run {
  return {
    id: row.id as string,
    clientId: row.clientId as string,
    status: down(row.status as string) as RunStatus,
    trigger: row.trigger as Run["trigger"],
    startedAt: (row.startedAt as Date).toISOString(),
    finishedAt: (row.finishedAt as Date | null)?.toISOString(),
    budget: {
      maxMs: row.maxMs as number,
      maxTokens: row.maxTokens as number,
      maxApiCalls: row.maxApiCalls as number,
    },
    spent: {
      ms: row.spentMs as number,
      tokens: row.spentTokens as number,
      apiCalls: row.spentCalls as number,
    },
  };
}

function toStep(row: Row): RunStep {
  return {
    id: row.id as string,
    runId: row.runId as string,
    agentName: row.agentName as RunStep["agentName"],
    ordinal: row.ordinal as number,
    status: down(row.status as string) as StepStatus,
    attempts: row.attempts as number,
    startedAt: (row.startedAt as Date | null)?.toISOString(),
    finishedAt: (row.finishedAt as Date | null)?.toISOString(),
    cost: {
      ms: row.costMs as number,
      tokens: row.costTokens as number,
      apiCalls: row.costCalls as number,
    },
    error: (row.error as string | null) ?? undefined,
    notes: (row.notes as string[]) ?? [],
  };
}

function toProposal(row: Row): Proposal {
  return {
    id: row.id as string,
    clientId: row.clientId as string,
    runId: row.runId as string,
    agentName: row.agentName as Proposal["agentName"],
    kind: row.kind as Proposal["kind"],
    target: {
      type: row.targetType as Proposal["target"]["type"],
      id: (row.targetId as string | null) ?? undefined,
    },
    payload: row.payload,
    rationale: row.rationale as string,
    evidenceIds: (row.evidenceIds as string[]) ?? [],
    riskTier: row.riskTier as Proposal["riskTier"],
    dedupeKey: row.dedupeKey as string,
    estimatedImpact: row.estimatedImpact as string,
    effortHours: row.effortHours as number,
    costToProduce: row.costToProduce as number,
    status: down(row.status as string) as ProposalStatus,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export class PrismaRuntimeStore implements RuntimeStore {
  private db = getPrismaClient();

  async upsertClient(client: ClientRecord): Promise<ClientRecord> {
    const data = {
      brand: client.brand,
      cadenceHours: client.cadenceHours,
      nextRunAt: client.nextRunAt ? new Date(client.nextRunAt) : null,
      leaseUntil: client.leaseUntil ? new Date(client.leaseUntil) : null,
      maxTokensPerRun: client.costBudget.maxTokensPerRun,
      maxApiCallsPerRun: client.costBudget.maxApiCallsPerRun,
      maxMsPerRun: client.costBudget.maxMsPerRun,
    };
    const row = await this.db.agentClient.upsert({
      where: { domain: client.domain },
      create: { domain: client.domain, ...data },
      update: data,
    });
    return toClient(row as unknown as Row);
  }

  async getClient(id: string): Promise<ClientRecord | null> {
    const row = await this.db.agentClient.findUnique({ where: { id } });
    return row ? toClient(row as unknown as Row) : null;
  }

  async claimDueClients(now: Date, limit: number, leaseMs: number): Promise<ClientRecord[]> {
    const lease = new Date(now.getTime() + leaseMs);
    const candidates = await this.db.agentClient.findMany({
      where: {
        nextRunAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      take: limit,
    });

    const claimed: ClientRecord[] = [];
    for (const candidate of candidates) {
      const result = await this.db.agentClient.updateMany({
        where: {
          id: candidate.id,
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
        },
        data: { leaseUntil: lease },
      });
      if (result.count === 1) {
        claimed.push(toClient({ ...(candidate as unknown as Row), leaseUntil: lease }));
      }
    }
    return claimed;
  }

  async createRun(run: Omit<Run, "id">): Promise<Run> {
    const row = await this.db.agentRun.create({
      data: {
        clientId: run.clientId,
        status: up(run.status) as never,
        trigger: run.trigger,
        startedAt: new Date(run.startedAt),
        maxMs: run.budget.maxMs,
        maxTokens: run.budget.maxTokens,
        maxApiCalls: run.budget.maxApiCalls,
        spentMs: run.spent.ms,
        spentTokens: run.spent.tokens,
        spentCalls: run.spent.apiCalls,
      },
    });
    return toRun(row as unknown as Row);
  }

  async getRun(id: string): Promise<Run | null> {
    const row = await this.db.agentRun.findUnique({ where: { id } });
    return row ? toRun(row as unknown as Row) : null;
  }

  async updateRun(id: string, patch: Partial<Omit<Run, "id">>): Promise<Run> {
    const row = await this.db.agentRun.update({
      where: { id },
      data: {
        ...(patch.status ? { status: up(patch.status) as never } : {}),
        ...(patch.finishedAt ? { finishedAt: new Date(patch.finishedAt) } : {}),
        ...(patch.spent
          ? {
              spentMs: patch.spent.ms,
              spentTokens: patch.spent.tokens,
              spentCalls: patch.spent.apiCalls,
            }
          : {}),
      },
    });
    return toRun(row as unknown as Row);
  }

  async openRunForClient(clientId: string): Promise<Run | null> {
    const row = await this.db.agentRun.findFirst({
      where: { clientId, status: { in: ["PENDING", "RUNNING"] as never } },
      orderBy: { startedAt: "desc" },
    });
    return row ? toRun(row as unknown as Row) : null;
  }

  async createSteps(steps: Omit<RunStep, "id">[]): Promise<RunStep[]> {
    const created: RunStep[] = [];
    for (const step of steps) {
      const row = await this.db.agentRunStep.create({
        data: {
          runId: step.runId,
          agentName: step.agentName,
          ordinal: step.ordinal,
          status: up(step.status) as never,
          attempts: step.attempts,
          costMs: step.cost.ms,
          costTokens: step.cost.tokens,
          costCalls: step.cost.apiCalls,
          notes: step.notes,
        },
      });
      created.push(toStep(row as unknown as Row));
    }
    return created;
  }

  async nextPendingStep(runId: string): Promise<RunStep | null> {
    const row = await this.db.agentRunStep.findFirst({
      where: { runId, status: "PENDING" as never },
      orderBy: { ordinal: "asc" },
    });
    return row ? toStep(row as unknown as Row) : null;
  }

  async updateStep(id: string, patch: Partial<Omit<RunStep, "id">>): Promise<RunStep> {
    const row = await this.db.agentRunStep.update({
      where: { id },
      data: {
        ...(patch.status ? { status: up(patch.status) as never } : {}),
        ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
        ...(patch.startedAt ? { startedAt: new Date(patch.startedAt) } : {}),
        ...(patch.finishedAt ? { finishedAt: new Date(patch.finishedAt) } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        ...(patch.notes ? { notes: patch.notes } : {}),
        ...(patch.cost
          ? {
              costMs: patch.cost.ms,
              costTokens: patch.cost.tokens,
              costCalls: patch.cost.apiCalls,
            }
          : {}),
      },
    });
    return toStep(row as unknown as Row);
  }

  async listSteps(runId: string): Promise<RunStep[]> {
    const rows = await this.db.agentRunStep.findMany({
      where: { runId },
      orderBy: { ordinal: "asc" },
    });
    return rows.map((row) => toStep(row as unknown as Row));
  }

  async upsertProposal(
    input: Omit<Proposal, "id" | "createdAt" | "updatedAt">,
  ): Promise<Proposal> {
    const data = {
      runId: input.runId,
      agentName: input.agentName,
      kind: input.kind,
      targetType: input.target.type,
      targetId: input.target.id ?? null,
      payload: input.payload as never,
      rationale: input.rationale,
      evidenceIds: input.evidenceIds,
      riskTier: input.riskTier,
      estimatedImpact: input.estimatedImpact,
      effortHours: input.effortHours,
      costToProduce: input.costToProduce,
      status: up(input.status) as never,
    };
    const row = await this.db.agentProposal.upsert({
      where: { clientId_dedupeKey: { clientId: input.clientId, dedupeKey: input.dedupeKey } },
      create: { clientId: input.clientId, dedupeKey: input.dedupeKey, ...data },
      update: data,
    });
    return toProposal(row as unknown as Row);
  }

  async findProposalByDedupeKey(clientId: string, dedupeKey: string): Promise<Proposal | null> {
    const row = await this.db.agentProposal.findUnique({
      where: { clientId_dedupeKey: { clientId, dedupeKey } },
    });
    return row ? toProposal(row as unknown as Row) : null;
  }

  async listProposals(filter: ProposalFilter): Promise<Proposal[]> {
    const rows = await this.db.agentProposal.findMany({
      where: {
        ...(filter.clientId ? { clientId: filter.clientId } : {}),
        ...(filter.runId ? { runId: filter.runId } : {}),
        ...(filter.status ? { status: up(filter.status) as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => toProposal(row as unknown as Row));
  }

  async setProposalStatus(id: string, status: ProposalStatus): Promise<Proposal> {
    const row = await this.db.agentProposal.update({
      where: { id },
      data: { status: up(status) as never },
    });
    return toProposal(row as unknown as Row);
  }
}
