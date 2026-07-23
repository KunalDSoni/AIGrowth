/**
 * Agent runtime persistence contract.
 *
 * InMemoryRuntimeStore backs unit tests. PrismaRuntimeStore backs real runs.
 */

import type {
  ClientRecord,
  Proposal,
  ProposalFilter,
  ProposalStatus,
  Run,
  RunStep,
} from "@/lib/agents/types";

export interface RuntimeStore {
  upsertClient(client: ClientRecord): Promise<ClientRecord>;
  getClient(id: string): Promise<ClientRecord | null>;
  claimDueClients(now: Date, limit: number, leaseMs: number): Promise<ClientRecord[]>;

  createRun(run: Omit<Run, "id">): Promise<Run>;
  getRun(id: string): Promise<Run | null>;
  updateRun(id: string, patch: Partial<Omit<Run, "id">>): Promise<Run>;
  openRunForClient(clientId: string): Promise<Run | null>;

  createSteps(steps: Omit<RunStep, "id">[]): Promise<RunStep[]>;
  nextPendingStep(runId: string): Promise<RunStep | null>;
  updateStep(id: string, patch: Partial<Omit<RunStep, "id">>): Promise<RunStep>;
  listSteps(runId: string): Promise<RunStep[]>;

  upsertProposal(input: Omit<Proposal, "id" | "createdAt" | "updatedAt">): Promise<Proposal>;
  findProposalByDedupeKey(clientId: string, dedupeKey: string): Promise<Proposal | null>;
  listProposals(filter: ProposalFilter): Promise<Proposal[]>;
  setProposalStatus(id: string, status: ProposalStatus): Promise<Proposal>;
}

export class InMemoryRuntimeStore implements RuntimeStore {
  private clients = new Map<string, ClientRecord>();
  private runs = new Map<string, Run>();
  private steps = new Map<string, RunStep>();
  private proposals = new Map<string, Proposal>();
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  async upsertClient(client: ClientRecord): Promise<ClientRecord> {
    this.clients.set(client.id, { ...client });
    return { ...client };
  }

  async getClient(id: string): Promise<ClientRecord | null> {
    const found = this.clients.get(id);
    return found ? { ...found } : null;
  }

  async claimDueClients(now: Date, limit: number, leaseMs: number): Promise<ClientRecord[]> {
    const iso = now.toISOString();
    const claimed: ClientRecord[] = [];
    for (const client of this.clients.values()) {
      if (claimed.length >= limit) break;
      const due = client.nextRunAt !== undefined && client.nextRunAt <= iso;
      const free = client.leaseUntil === undefined || client.leaseUntil <= iso;
      if (!due || !free) continue;
      client.leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
      claimed.push({ ...client });
    }
    return claimed;
  }

  async createRun(run: Omit<Run, "id">): Promise<Run> {
    const created: Run = { ...run, id: this.nextId("run") };
    this.runs.set(created.id, created);
    return { ...created };
  }

  async getRun(id: string): Promise<Run | null> {
    const found = this.runs.get(id);
    return found ? { ...found } : null;
  }

  async updateRun(id: string, patch: Partial<Omit<Run, "id">>): Promise<Run> {
    const found = this.runs.get(id);
    if (!found) throw new Error(`Run not found: ${id}`);
    const updated = { ...found, ...patch };
    this.runs.set(id, updated);
    return { ...updated };
  }

  async openRunForClient(clientId: string): Promise<Run | null> {
    for (const run of this.runs.values()) {
      if (run.clientId === clientId && (run.status === "pending" || run.status === "running")) {
        return { ...run };
      }
    }
    return null;
  }

  async createSteps(steps: Omit<RunStep, "id">[]): Promise<RunStep[]> {
    return steps.map((step) => {
      const created: RunStep = { ...step, id: this.nextId("step") };
      this.steps.set(created.id, created);
      return { ...created };
    });
  }

  async nextPendingStep(runId: string): Promise<RunStep | null> {
    const pending = [...this.steps.values()]
      .filter((s) => s.runId === runId && s.status === "pending")
      .sort((a, b) => a.ordinal - b.ordinal);
    return pending.length ? { ...pending[0]! } : null;
  }

  async updateStep(id: string, patch: Partial<Omit<RunStep, "id">>): Promise<RunStep> {
    const found = this.steps.get(id);
    if (!found) throw new Error(`Step not found: ${id}`);
    const updated = { ...found, ...patch };
    this.steps.set(id, updated);
    return { ...updated };
  }

  async listSteps(runId: string): Promise<RunStep[]> {
    return [...this.steps.values()]
      .filter((s) => s.runId === runId)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((s) => ({ ...s }));
  }

  async upsertProposal(
    input: Omit<Proposal, "id" | "createdAt" | "updatedAt">,
  ): Promise<Proposal> {
    const existing = await this.findProposalByDedupeKey(input.clientId, input.dedupeKey);
    const nowIso = new Date().toISOString();
    if (existing) {
      const updated: Proposal = { ...existing, ...input, id: existing.id, updatedAt: nowIso };
      this.proposals.set(existing.id, updated);
      return { ...updated };
    }
    const created: Proposal = {
      ...input,
      id: this.nextId("prop"),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.proposals.set(created.id, created);
    return { ...created };
  }

  async findProposalByDedupeKey(clientId: string, dedupeKey: string): Promise<Proposal | null> {
    for (const proposal of this.proposals.values()) {
      if (proposal.clientId === clientId && proposal.dedupeKey === dedupeKey) {
        return { ...proposal };
      }
    }
    return null;
  }

  async listProposals(filter: ProposalFilter): Promise<Proposal[]> {
    return [...this.proposals.values()]
      .filter((p) => (filter.clientId ? p.clientId === filter.clientId : true))
      .filter((p) => (filter.runId ? p.runId === filter.runId : true))
      .filter((p) => (filter.status ? p.status === filter.status : true))
      .map((p) => ({ ...p }));
  }

  async setProposalStatus(id: string, status: ProposalStatus): Promise<Proposal> {
    const found = this.proposals.get(id);
    if (!found) throw new Error(`Proposal not found: ${id}`);
    const updated: Proposal = { ...found, status, updatedAt: new Date().toISOString() };
    this.proposals.set(id, updated);
    return { ...updated };
  }
}
