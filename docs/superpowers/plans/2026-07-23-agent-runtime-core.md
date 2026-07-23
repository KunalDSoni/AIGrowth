# Agent Runtime Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resumable, cost-governed agent run loop that a cron tick advances for each client, where agents emit deduplicated proposals instead of mutating client artifacts.

**Architecture:** A `RuntimeStore` interface owns all persistence, with an in-memory implementation for tests and a Prisma/PostgreSQL implementation for real use. A registry maps `AgentName` to an `Agent` implementation. `advanceRun()` executes pending `RunStep`s within time and cost budgets, persisting after each step so a crashed tick resumes without losing work. Agents never write client artifacts — they return `Proposal` drafts that upsert by `dedupeKey`.

**Tech Stack:** TypeScript, Next.js 15 App Router, Prisma 6 + PostgreSQL, Vitest, existing `lib/engines/*` modules.

## Global Constraints

- Persistence is PostgreSQL only. Prisma does not support enums on SQLite and does not accept `env()` for a datasource provider. Local development runs PostgreSQL in Docker.
- `npm test` must pass with no database available. Unit tests use `InMemoryRuntimeStore`; integration tests skip when `DATABASE_URL` is unset.
- No agent may reference an industry. Vertical knowledge lives in data, never in code.
- Agents never mutate client artifacts. Every output is a `Proposal`.
- Every `execute()` returns a `CostRecord`. Cost is measured, never estimated.
- Existing engines in `lib/engines/*` are wrapped, not rewritten.
- `npm run lint` runs with `--max-warnings=0`. No unused imports or variables.
- Import alias is `@/` mapped to the repo root.

---

### Task 1: Runtime domain types and in-memory store

**Files:**
- Create: `lib/agents/types.ts`
- Create: `lib/agents/store.ts`
- Test: `tests/unit/agent-store.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `AgentName`, `RunStatus`, `StepStatus`, `RiskTier`, `ProposalStatus`, `ProposalKind`, `ProposalTargetType`, `CostRecord`, `Proposal`, `ProposalDraft`, `ProposalFilter`, `StepResult`, `RunBudget`, `Run`, `RunStep`, `ClientCostBudget`, `ClientRecord`, `RuntimeStore`, `InMemoryRuntimeStore`, `emptyCost()`, `addCost(a, b)`. `RunContext` is defined in Task 3, not here.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { emptyCost } from "@/lib/agents/types";

function store() {
  return new InMemoryRuntimeStore();
}

describe("InMemoryRuntimeStore", () => {
  it("creates a client and returns it by id", async () => {
    const s = store();
    const client = await s.upsertClient({
      id: "client-dosacc",
      domain: "dosacc.com",
      brand: "DiligenceOS",
      cadenceHours: 168,
      costBudget: { maxTokensPerRun: 50_000, maxApiCallsPerRun: 40, maxMsPerRun: 120_000 },
    });
    expect(client.domain).toBe("dosacc.com");
    expect(await s.getClient("client-dosacc")).toEqual(client);
  });

  it("claims only clients whose nextRunAt has passed, and leases them", async () => {
    const s = store();
    const now = new Date("2026-07-23T12:00:00.000Z");
    await s.upsertClient({
      id: "due",
      domain: "due.example",
      brand: "Due",
      cadenceHours: 24,
      nextRunAt: "2026-07-23T11:00:00.000Z",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 10 },
    });
    await s.upsertClient({
      id: "not-due",
      domain: "notdue.example",
      brand: "NotDue",
      cadenceHours: 24,
      nextRunAt: "2026-07-23T18:00:00.000Z",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 10 },
    });

    const claimed = await s.claimDueClients(now, 10, 60_000);
    expect(claimed.map((c) => c.id)).toEqual(["due"]);

    const again = await s.claimDueClients(now, 10, 60_000);
    expect(again).toEqual([]);
  });

  it("re-claims a client once its lease expires", async () => {
    const s = store();
    await s.upsertClient({
      id: "leased",
      domain: "leased.example",
      brand: "Leased",
      cadenceHours: 24,
      nextRunAt: "2026-07-23T11:00:00.000Z",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 10 },
    });
    const first = new Date("2026-07-23T12:00:00.000Z");
    expect((await s.claimDueClients(first, 10, 60_000)).length).toBe(1);

    const afterLease = new Date("2026-07-23T12:02:00.000Z");
    expect((await s.claimDueClients(afterLease, 10, 60_000)).length).toBe(1);
  });

  it("stores a run with its steps and returns the next pending step in order", async () => {
    const s = store();
    const run = await s.createRun({
      clientId: "c1",
      status: "pending",
      trigger: "cron",
      startedAt: "2026-07-23T12:00:00.000Z",
      budget: { maxMs: 1000, maxTokens: 100, maxApiCalls: 5 },
      spent: emptyCost(),
    });
    await s.createSteps([
      { runId: run.id, agentName: "observer", ordinal: 0, status: "pending", attempts: 0, cost: emptyCost(), notes: [] },
      { runId: run.id, agentName: "strategist", ordinal: 1, status: "pending", attempts: 0, cost: emptyCost(), notes: [] },
    ]);

    const next = await s.nextPendingStep(run.id);
    expect(next?.agentName).toBe("observer");

    await s.updateStep(next!.id, { status: "ok" });
    const after = await s.nextPendingStep(run.id);
    expect(after?.agentName).toBe("strategist");
  });

  it("returns null for nextPendingStep when every step is finished", async () => {
    const s = store();
    const run = await s.createRun({
      clientId: "c1",
      status: "running",
      trigger: "manual",
      startedAt: "2026-07-23T12:00:00.000Z",
      budget: { maxMs: 1000, maxTokens: 100, maxApiCalls: 5 },
      spent: emptyCost(),
    });
    await s.createSteps([
      { runId: run.id, agentName: "observer", ordinal: 0, status: "ok", attempts: 1, cost: emptyCost(), notes: [] },
    ]);
    expect(await s.nextPendingStep(run.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-store.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/store"`

- [ ] **Step 3: Write the types**

Create `lib/agents/types.ts`:

```ts
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
```

- [ ] **Step 4: Write the store**

Create `lib/agents/store.ts`:

```ts
/**
 * Agent runtime persistence contract.
 *
 * InMemoryRuntimeStore backs unit tests. PrismaRuntimeStore (Task 6) backs real runs.
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-store.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add lib/agents/types.ts lib/agents/store.ts tests/unit/agent-store.test.ts
git commit -m "feat(agents): runtime domain types and in-memory store"
```

---

### Task 2: Proposal dedupe semantics

**Files:**
- Create: `lib/agents/proposals.ts`
- Test: `tests/unit/agent-proposals.test.ts`

**Interfaces:**
- Consumes: `RuntimeStore`, `Proposal`, `ProposalDraft`, `AgentName` from Task 1
- Produces: `recordProposals(store, ctx, drafts): Promise<Proposal[]>` where `ctx` is `{ clientId: string; runId: string; agentName: AgentName }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-proposals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { recordProposals } from "@/lib/agents/proposals";
import type { ProposalDraft } from "@/lib/agents/types";

function draft(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    kind: "create",
    target: { type: "page-change" },
    payload: { title: "Add FAQ answers" },
    rationale: "No answer-shaped content for buyer prompts",
    evidenceIds: ["ev-1"],
    riskTier: "low",
    dedupeKey: "gap:answer-shaped-content",
    estimatedImpact: "+2-5 pts answer share",
    effortHours: 3,
    costToProduce: 0.4,
    ...overrides,
  };
}

const ctx = { clientId: "c1", runId: "r1", agentName: "diagnosis" as const };

describe("recordProposals", () => {
  it("creates a pending proposal on first discovery", async () => {
    const store = new InMemoryRuntimeStore();
    const [proposal] = await recordProposals(store, ctx, [draft()]);
    expect(proposal!.status).toBe("pending");
    expect(proposal!.agentName).toBe("diagnosis");
    expect((await store.listProposals({ clientId: "c1" })).length).toBe(1);
  });

  it("updates in place when the same dedupeKey is rediscovered", async () => {
    const store = new InMemoryRuntimeStore();
    const [first] = await recordProposals(store, ctx, [draft()]);
    const [second] = await recordProposals(store, { ...ctx, runId: "r2" }, [
      draft({ rationale: "Still missing after 7 days", effortHours: 4 }),
    ]);

    expect(second!.id).toBe(first!.id);
    expect(second!.rationale).toBe("Still missing after 7 days");
    expect(second!.effortHours).toBe(4);
    expect(second!.runId).toBe("r2");
    expect((await store.listProposals({ clientId: "c1" })).length).toBe(1);
  });

  it("does not resurrect a rejected proposal", async () => {
    const store = new InMemoryRuntimeStore();
    const [first] = await recordProposals(store, ctx, [draft()]);
    await store.setProposalStatus(first!.id, "rejected");

    const [second] = await recordProposals(store, { ...ctx, runId: "r2" }, [draft()]);
    expect(second!.status).toBe("rejected");
    expect((await store.listProposals({ clientId: "c1", status: "pending" })).length).toBe(0);
  });

  it("supersedes an accepted proposal when the finding recurs", async () => {
    const store = new InMemoryRuntimeStore();
    const [first] = await recordProposals(store, ctx, [draft()]);
    await store.setProposalStatus(first!.id, "accepted");

    const [second] = await recordProposals(store, { ...ctx, runId: "r2" }, [draft()]);
    expect(second!.id).toBe(first!.id);
    expect(second!.status).toBe("pending");
  });

  it("keeps proposals from different clients separate", async () => {
    const store = new InMemoryRuntimeStore();
    await recordProposals(store, ctx, [draft()]);
    await recordProposals(store, { ...ctx, clientId: "c2" }, [draft()]);
    expect((await store.listProposals({ clientId: "c1" })).length).toBe(1);
    expect((await store.listProposals({ clientId: "c2" })).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-proposals.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/proposals"`

- [ ] **Step 3: Write the implementation**

Create `lib/agents/proposals.ts`:

```ts
/**
 * Proposal recording.
 *
 * Rediscovery of a known finding updates the existing proposal rather than
 * stacking a duplicate into the operator queue. A human "no" is durable:
 * rejected proposals stay rejected. An accepted proposal that recurs means the
 * fix did not hold, so it returns to the queue as pending.
 */

import type { RuntimeStore } from "@/lib/agents/store";
import type { AgentName, Proposal, ProposalDraft } from "@/lib/agents/types";

export interface ProposalContext {
  clientId: string;
  runId: string;
  agentName: AgentName;
}

export async function recordProposals(
  store: RuntimeStore,
  ctx: ProposalContext,
  drafts: ProposalDraft[],
): Promise<Proposal[]> {
  const recorded: Proposal[] = [];
  for (const draft of drafts) {
    const existing = await store.findProposalByDedupeKey(ctx.clientId, draft.dedupeKey);

    if (existing?.status === "rejected") {
      recorded.push(existing);
      continue;
    }

    recorded.push(
      await store.upsertProposal({
        ...draft,
        clientId: ctx.clientId,
        runId: ctx.runId,
        agentName: ctx.agentName,
        status: "pending",
      }),
    );
  }
  return recorded;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-proposals.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/agents/proposals.ts tests/unit/agent-proposals.test.ts
git commit -m "feat(agents): proposal dedupe with durable rejection"
```

---

### Task 3: Agent contract and registry

**Files:**
- Create: `lib/agents/agent.ts`
- Create: `lib/agents/registry.ts`
- Test: `tests/unit/agent-registry.test.ts`

**Interfaces:**
- Consumes: `AgentName`, `ClientRecord`, `Run`, `RunStep`, `StepResult` from Task 1; `RuntimeStore` from Task 1
- Produces: `Agent`, `RunContext`, `ShouldRunVerdict`, `AgentRegistry`, `createRegistry(agents)`, `DEFAULT_PIPELINE`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRegistry, DEFAULT_PIPELINE } from "@/lib/agents/registry";
import type { Agent } from "@/lib/agents/agent";
import { emptyCost } from "@/lib/agents/types";

const stub: Agent = {
  name: "observer",
  costClass: "moderate",
  async shouldRun() {
    return { run: true, reason: "always" };
  },
  async execute() {
    return { status: "ok", proposals: [], cost: emptyCost(), notes: [] };
  },
};

describe("agent registry", () => {
  it("returns a registered agent by name", () => {
    const registry = createRegistry([stub]);
    expect(registry.get("observer")).toBe(stub);
  });

  it("throws a named error for an unregistered agent", () => {
    const registry = createRegistry([]);
    expect(() => registry.get("observer")).toThrow("No agent registered for: observer");
  });

  it("rejects duplicate registrations", () => {
    expect(() => createRegistry([stub, stub])).toThrow("Duplicate agent registration: observer");
  });

  it("declares the pipeline in dependency order", () => {
    expect(DEFAULT_PIPELINE).toEqual([
      "observer",
      "onboarding",
      "diagnosis",
      "strategist",
      "packager",
      "compliance",
      "reporter",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-registry.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/registry"`

- [ ] **Step 3: Write the agent contract**

Create `lib/agents/agent.ts`:

```ts
/**
 * The agent contract.
 *
 * No agent knows which client or industry it serves. Both arrive via RunContext.
 * shouldRun() must decide cheaply — it protects margin by skipping work before
 * any token is spent.
 */

import type { RuntimeStore } from "@/lib/agents/store";
import type { AgentName, ClientRecord, Run, RunStep, StepResult } from "@/lib/agents/types";

export interface RunContext {
  client: ClientRecord;
  run: Run;
  step: RunStep;
  store: RuntimeStore;
  now: () => Date;
}

export interface ShouldRunVerdict {
  run: boolean;
  reason: string;
}

export interface Agent {
  name: AgentName;
  costClass: "cheap" | "moderate" | "expensive";
  shouldRun(ctx: RunContext): Promise<ShouldRunVerdict>;
  execute(ctx: RunContext): Promise<StepResult>;
}
```

- [ ] **Step 4: Write the registry**

Create `lib/agents/registry.ts`:

```ts
import type { Agent } from "@/lib/agents/agent";
import type { AgentName } from "@/lib/agents/types";

/** Pipeline order. Each agent may read what earlier agents wrote in the same run. */
export const DEFAULT_PIPELINE: AgentName[] = [
  "observer",
  "onboarding",
  "diagnosis",
  "strategist",
  "packager",
  "compliance",
  "reporter",
];

export interface AgentRegistry {
  get(name: AgentName): Agent;
  has(name: AgentName): boolean;
}

export function createRegistry(agents: Agent[]): AgentRegistry {
  const byName = new Map<AgentName, Agent>();
  for (const agent of agents) {
    if (byName.has(agent.name)) {
      throw new Error(`Duplicate agent registration: ${agent.name}`);
    }
    byName.set(agent.name, agent);
  }

  return {
    get(name) {
      const agent = byName.get(name);
      if (!agent) throw new Error(`No agent registered for: ${name}`);
      return agent;
    },
    has(name) {
      return byName.has(name);
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-registry.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add lib/agents/agent.ts lib/agents/registry.ts tests/unit/agent-registry.test.ts
git commit -m "feat(agents): agent contract and registry"
```

---

### Task 4: Cost governor

**Files:**
- Create: `lib/agents/cost-governor.ts`
- Test: `tests/unit/agent-cost-governor.test.ts`

**Interfaces:**
- Consumes: `CostRecord`, `RunBudget`, `ClientCostBudget`, `addCost`, `emptyCost` from Task 1
- Produces: `budgetFromClient(budget: ClientCostBudget): RunBudget`, `remaining(budget, spent): CostRecord`, `canAfford(budget, spent): { ok: boolean; reason: string }`, `costToServe(steps: { cost: CostRecord }[]): CostRecord`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-cost-governor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { budgetFromClient, canAfford, costToServe, remaining } from "@/lib/agents/cost-governor";
import { emptyCost } from "@/lib/agents/types";

const budget = { maxMs: 60_000, maxTokens: 10_000, maxApiCalls: 20 };

describe("cost governor", () => {
  it("derives a run budget from the client budget", () => {
    expect(
      budgetFromClient({ maxTokensPerRun: 500, maxApiCallsPerRun: 4, maxMsPerRun: 9_000 }),
    ).toEqual({ maxTokens: 500, maxApiCalls: 4, maxMs: 9_000 });
  });

  it("reports remaining headroom", () => {
    expect(remaining(budget, { tokens: 2_000, apiCalls: 5, ms: 10_000 })).toEqual({
      tokens: 8_000,
      apiCalls: 15,
      ms: 50_000,
    });
  });

  it("clamps remaining headroom at zero", () => {
    expect(remaining(budget, { tokens: 99_999, apiCalls: 99, ms: 99_999 })).toEqual({
      tokens: 0,
      apiCalls: 0,
      ms: 0,
    });
  });

  it("allows work while every dimension has headroom", () => {
    expect(canAfford(budget, emptyCost())).toEqual({ ok: true, reason: "within budget" });
  });

  it("blocks on token exhaustion and names the dimension", () => {
    expect(canAfford(budget, { tokens: 10_000, apiCalls: 0, ms: 0 })).toEqual({
      ok: false,
      reason: "token budget exhausted",
    });
  });

  it("blocks on api call exhaustion", () => {
    expect(canAfford(budget, { tokens: 0, apiCalls: 20, ms: 0 })).toEqual({
      ok: false,
      reason: "api call budget exhausted",
    });
  });

  it("blocks on time exhaustion", () => {
    expect(canAfford(budget, { tokens: 0, apiCalls: 0, ms: 60_000 })).toEqual({
      ok: false,
      reason: "time budget exhausted",
    });
  });

  it("sums cost to serve across steps", () => {
    expect(
      costToServe([
        { cost: { tokens: 100, apiCalls: 1, ms: 500 } },
        { cost: { tokens: 250, apiCalls: 2, ms: 1_500 } },
      ]),
    ).toEqual({ tokens: 350, apiCalls: 3, ms: 2_000 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-cost-governor.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/cost-governor"`

- [ ] **Step 3: Write the implementation**

Create `lib/agents/cost-governor.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-cost-governor.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/agents/cost-governor.ts tests/unit/agent-cost-governor.test.ts
git commit -m "feat(agents): cost governor with hard run budgets"
```

---

### Task 5: Resumable run machine

**Files:**
- Create: `lib/agents/runner.ts`
- Test: `tests/unit/agent-runner.test.ts`

**Interfaces:**
- Consumes: `RuntimeStore`, `InMemoryRuntimeStore` (Task 1), `recordProposals` (Task 2), `AgentRegistry`, `DEFAULT_PIPELINE`, `Agent` (Task 3), `canAfford`, `budgetFromClient` (Task 4)
- Produces: `MAX_STEP_ATTEMPTS`, `startRun(store, client, trigger, pipeline): Promise<Run>`, `advanceRun(deps): Promise<AdvanceResult>` where `deps` is `{ store, registry, client, run, now?, maxSteps? }` and `AdvanceResult` is `{ run: Run; stepsExecuted: number; stopReason: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-runner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { createRegistry } from "@/lib/agents/registry";
import { advanceRun, MAX_STEP_ATTEMPTS, startRun } from "@/lib/agents/runner";
import type { Agent } from "@/lib/agents/agent";
import type { ClientRecord, StepResult } from "@/lib/agents/types";
import { emptyCost } from "@/lib/agents/types";

const client: ClientRecord = {
  id: "c1",
  domain: "dosacc.com",
  brand: "DiligenceOS",
  cadenceHours: 168,
  costBudget: { maxTokensPerRun: 1_000, maxApiCallsPerRun: 10, maxMsPerRun: 60_000 },
};

function agent(name: Agent["name"], result: () => Promise<StepResult>): Agent {
  return {
    name,
    costClass: "cheap",
    async shouldRun() {
      return { run: true, reason: "test" };
    },
    execute: result,
  };
}

const ok = (tokens = 10): StepResult => ({
  status: "ok",
  proposals: [],
  cost: { tokens, apiCalls: 1, ms: 5 },
  notes: [],
});

describe("advanceRun", () => {
  it("executes every step and completes the run", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => ok()),
      agent("strategist", async () => ok()),
    ]);
    const run = await startRun(store, client, "manual", ["observer", "strategist"]);

    const result = await advanceRun({ store, registry, client, run });

    expect(result.stepsExecuted).toBe(2);
    expect(result.run.status).toBe("done");
    expect(result.run.spent.tokens).toBe(20);
    expect((await store.listSteps(run.id)).map((s) => s.status)).toEqual(["ok", "ok"]);
  });

  it("resumes across ticks without repeating completed steps", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => ok()),
      agent("strategist", async () => ok()),
    ]);
    const run = await startRun(store, client, "cron", ["observer", "strategist"]);

    const first = await advanceRun({ store, registry, client, run, maxSteps: 1 });
    expect(first.stepsExecuted).toBe(1);
    expect(first.run.status).toBe("running");

    const second = await advanceRun({ store, registry, client, run: first.run });
    expect(second.stepsExecuted).toBe(1);
    expect(second.run.status).toBe("done");
    expect((await store.listSteps(run.id)).filter((s) => s.status === "ok").length).toBe(2);
  });

  it("keeps completed work when a later step throws", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => ok()),
      agent("strategist", async () => {
        throw new Error("provider exploded");
      }),
    ]);
    const run = await startRun(store, client, "cron", ["observer", "strategist"]);

    const result = await advanceRun({ store, registry, client, run });

    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("ok");
    expect(steps[1]!.status).toBe("pending");
    expect(steps[1]!.attempts).toBe(1);
    expect(steps[1]!.error).toBe("provider exploded");
    expect(result.run.status).toBe("running");
  });

  it("blocks the run after MAX_STEP_ATTEMPTS failures", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("observer", async () => {
        throw new Error("always fails");
      }),
    ]);
    let run = await startRun(store, client, "cron", ["observer"]);

    for (let i = 0; i < MAX_STEP_ATTEMPTS; i += 1) {
      run = (await advanceRun({ store, registry, client, run })).run;
    }

    expect(run.status).toBe("blocked");
    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("failed");
    expect(steps[0]!.attempts).toBe(MAX_STEP_ATTEMPTS);
  });

  it("skips a step whose agent declines to run, without spending cost", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const skipper: Agent = {
      name: "observer",
      costClass: "cheap",
      async shouldRun() {
        return { run: false, reason: "no crawl delta" };
      },
      async execute() {
        throw new Error("must not execute");
      },
    };
    const registry = createRegistry([skipper]);
    const run = await startRun(store, client, "cron", ["observer"]);

    const result = await advanceRun({ store, registry, client, run });

    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("skipped");
    expect(steps[0]!.notes).toContain("no crawl delta");
    expect(result.run.spent).toEqual(emptyCost());
    expect(result.run.status).toBe("done");
  });

  it("pauses at a step boundary when the cost budget is exhausted", async () => {
    const store = new InMemoryRuntimeStore();
    const tightClient: ClientRecord = {
      ...client,
      id: "c-tight",
      costBudget: { maxTokensPerRun: 10, maxApiCallsPerRun: 10, maxMsPerRun: 60_000 },
    };
    await store.upsertClient(tightClient);
    const registry = createRegistry([
      agent("observer", async () => ok(10)),
      agent("strategist", async () => ok(10)),
    ]);
    const run = await startRun(store, tightClient, "cron", ["observer", "strategist"]);

    const result = await advanceRun({ store, registry, client: tightClient, run });

    expect(result.stepsExecuted).toBe(1);
    expect(result.stopReason).toBe("token budget exhausted");
    expect(result.run.status).toBe("running");
  });

  it("records proposals returned by an agent", async () => {
    const store = new InMemoryRuntimeStore();
    await store.upsertClient(client);
    const registry = createRegistry([
      agent("diagnosis", async () => ({
        status: "ok",
        cost: { tokens: 5, apiCalls: 1, ms: 5 },
        notes: [],
        proposals: [
          {
            kind: "create",
            target: { type: "page-change" },
            payload: { title: "Add answer section" },
            rationale: "Absent from buyer prompts",
            evidenceIds: ["ev-1"],
            riskTier: "low",
            dedupeKey: "gap:answer-section",
            estimatedImpact: "+2 pts",
            effortHours: 2,
            costToProduce: 0.2,
          },
        ],
      })),
    ]);
    const run = await startRun(store, client, "cron", ["diagnosis"]);

    await advanceRun({ store, registry, client, run });

    const proposals = await store.listProposals({ clientId: "c1", status: "pending" });
    expect(proposals.length).toBe(1);
    expect(proposals[0]!.agentName).toBe("diagnosis");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-runner.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/runner"`

- [ ] **Step 3: Write the implementation**

Create `lib/agents/runner.ts`:

```ts
/**
 * The run machine.
 *
 * Steps are the unit of resumption: a failure in step N never discards the work
 * of step N-1. A tick advances a run as far as its time and cost budgets allow,
 * persisting after each step.
 */

import { budgetFromClient, canAfford } from "@/lib/agents/cost-governor";
import { recordProposals } from "@/lib/agents/proposals";
import { DEFAULT_PIPELINE } from "@/lib/agents/registry";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { RuntimeStore } from "@/lib/agents/store";
import { addCost, emptyCost } from "@/lib/agents/types";
import type { AgentName, ClientRecord, Run, RunStep } from "@/lib/agents/types";

export const MAX_STEP_ATTEMPTS = 3;

export interface AdvanceDeps {
  store: RuntimeStore;
  registry: AgentRegistry;
  client: ClientRecord;
  run: Run;
  now?: () => Date;
  maxSteps?: number;
}

export interface AdvanceResult {
  run: Run;
  stepsExecuted: number;
  stopReason: string;
}

export async function startRun(
  store: RuntimeStore,
  client: ClientRecord,
  trigger: Run["trigger"],
  pipeline: AgentName[] = DEFAULT_PIPELINE,
): Promise<Run> {
  const run = await store.createRun({
    clientId: client.id,
    status: "pending",
    trigger,
    startedAt: new Date().toISOString(),
    budget: budgetFromClient(client.costBudget),
    spent: emptyCost(),
  });

  await store.createSteps(
    pipeline.map((agentName, ordinal) => ({
      runId: run.id,
      agentName,
      ordinal,
      status: "pending" as const,
      attempts: 0,
      cost: emptyCost(),
      notes: [],
    })),
  );

  return run;
}

export async function advanceRun(deps: AdvanceDeps): Promise<AdvanceResult> {
  const { store, registry, client } = deps;
  const now = deps.now ?? (() => new Date());
  const maxSteps = deps.maxSteps ?? Number.POSITIVE_INFINITY;

  let run = deps.run;
  let stepsExecuted = 0;

  if (run.status === "pending") {
    run = await store.updateRun(run.id, { status: "running" });
  }

  while (stepsExecuted < maxSteps) {
    const affordable = canAfford(run.budget, run.spent);
    if (!affordable.ok) {
      return { run, stepsExecuted, stopReason: affordable.reason };
    }

    const step = await store.nextPendingStep(run.id);
    if (!step) {
      run = await store.updateRun(run.id, {
        status: "done",
        finishedAt: now().toISOString(),
      });
      return { run, stepsExecuted, stopReason: "pipeline complete" };
    }

    const outcome = await executeStep({ store, registry, client, run, step, now });
    stepsExecuted += 1;

    if (outcome.blocked) {
      run = await store.updateRun(run.id, { status: "blocked" });
      return { run, stepsExecuted, stopReason: "step exceeded max attempts" };
    }

    if (outcome.cost) {
      run = await store.updateRun(run.id, { spent: addCost(run.spent, outcome.cost) });
    }

    if (outcome.retryable) {
      return { run, stepsExecuted, stopReason: "step failed, will retry next tick" };
    }
  }

  return { run, stepsExecuted, stopReason: "step limit reached" };
}

interface StepOutcome {
  blocked: boolean;
  retryable: boolean;
  cost?: { tokens: number; apiCalls: number; ms: number };
}

async function executeStep(args: {
  store: RuntimeStore;
  registry: AgentRegistry;
  client: ClientRecord;
  run: Run;
  step: RunStep;
  now: () => Date;
}): Promise<StepOutcome> {
  const { store, registry, client, run, step, now } = args;
  const agent = registry.get(step.agentName);

  const running = await store.updateStep(step.id, {
    status: "running",
    startedAt: now().toISOString(),
  });

  const ctx = { client, run, step: running, store, now };

  const verdict = await agent.shouldRun(ctx);
  if (!verdict.run) {
    await store.updateStep(step.id, {
      status: "skipped",
      finishedAt: now().toISOString(),
      notes: [verdict.reason],
    });
    return { blocked: false, retryable: false };
  }

  try {
    const result = await agent.execute(ctx);

    if (result.proposals.length) {
      await recordProposals(
        store,
        { clientId: client.id, runId: run.id, agentName: agent.name },
        result.proposals,
      );
    }

    await store.updateStep(step.id, {
      status: result.status,
      finishedAt: now().toISOString(),
      cost: result.cost,
      notes: result.notes,
      attempts: step.attempts + 1,
    });

    return { blocked: false, retryable: false, cost: result.cost };
  } catch (error) {
    const attempts = step.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = attempts >= MAX_STEP_ATTEMPTS;

    await store.updateStep(step.id, {
      status: exhausted ? "failed" : "pending",
      attempts,
      error: message,
      finishedAt: exhausted ? now().toISOString() : undefined,
    });

    return { blocked: exhausted, retryable: !exhausted };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-runner.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Run the whole unit suite to catch regressions**

Run: `npm test`
Expected: PASS — all existing tests plus the four new agent test files

- [ ] **Step 6: Commit**

```bash
git add lib/agents/runner.ts tests/unit/agent-runner.test.ts
git commit -m "feat(agents): resumable run machine with retry and budget pausing"
```

---

### Task 6: Prisma models and PrismaRuntimeStore

**Files:**
- Modify: `prisma/schema.prisma` (append after the final existing model)
- Create: `lib/agents/prisma-store.ts`
- Create: `tests/integration/prisma-runtime-store.test.ts`
- Modify: `vitest.config.ts:1-3`
- Modify: `.env.example:1`

**Interfaces:**
- Consumes: `RuntimeStore` and all types from Task 1; `getPrismaClient()` from `lib/db/prisma.ts`
- Produces: `PrismaRuntimeStore` implementing `RuntimeStore`

- [ ] **Step 1: Add the Prisma models**

Append to `prisma/schema.prisma`:

```prisma
enum AgentRunStatus {
  PENDING
  RUNNING
  BLOCKED
  DONE
  FAILED
}

enum AgentStepStatus {
  PENDING
  RUNNING
  OK
  SKIPPED
  FAILED
  NEEDS_INPUT
}

enum AgentProposalStatus {
  PENDING
  ACCEPTED
  REJECTED
  SUPERSEDED
}

model AgentClient {
  id                String         @id @default(cuid())
  domain            String         @unique
  brand             String
  cadenceHours      Int            @default(168)
  nextRunAt         DateTime?
  leaseUntil        DateTime?
  maxTokensPerRun   Int            @default(50000)
  maxApiCallsPerRun Int            @default(40)
  maxMsPerRun       Int            @default(120000)
  createdAt         DateTime       @default(now())
  runs              AgentRun[]
  proposals         AgentProposal[]

  @@index([nextRunAt, leaseUntil])
}

model AgentRun {
  id          String          @id @default(cuid())
  clientId    String
  client      AgentClient     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  status      AgentRunStatus  @default(PENDING)
  trigger     String
  startedAt   DateTime        @default(now())
  finishedAt  DateTime?
  maxMs       Int
  maxTokens   Int
  maxApiCalls Int
  spentMs     Int             @default(0)
  spentTokens Int             @default(0)
  spentCalls  Int             @default(0)
  steps       AgentRunStep[]
  proposals   AgentProposal[]

  @@index([clientId, status])
}

model AgentRunStep {
  id         String          @id @default(cuid())
  runId      String
  run        AgentRun        @relation(fields: [runId], references: [id], onDelete: Cascade)
  agentName  String
  ordinal    Int
  status     AgentStepStatus @default(PENDING)
  attempts   Int             @default(0)
  startedAt  DateTime?
  finishedAt DateTime?
  costMs     Int             @default(0)
  costTokens Int             @default(0)
  costCalls  Int             @default(0)
  error      String?
  notes      String[]

  @@unique([runId, ordinal])
  @@index([runId, status])
}

model AgentProposal {
  id              String              @id @default(cuid())
  clientId        String
  client          AgentClient         @relation(fields: [clientId], references: [id], onDelete: Cascade)
  runId           String
  run             AgentRun            @relation(fields: [runId], references: [id], onDelete: Cascade)
  agentName       String
  kind            String
  targetType      String
  targetId        String?
  payload         Json
  rationale       String
  evidenceIds     String[]
  riskTier        String
  dedupeKey       String
  estimatedImpact String
  effortHours     Float
  costToProduce   Float
  status          AgentProposalStatus @default(PENDING)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@unique([clientId, dedupeKey])
  @@index([clientId, status])
}
```

- [ ] **Step 2: Generate the client and create the migration**

Run:
```bash
docker run --name opengrowth-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=opengrowth -p 5432:5432 -d postgres:16
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/opengrowth"
npx prisma migrate dev --name agent_runtime
```
Expected: `Your database is now in sync with your schema.` and a new folder under `prisma/migrations/`.

- [ ] **Step 3: Write the failing integration test**

Create `tests/integration/prisma-runtime-store.test.ts`:

```ts
import { describe, expect, it, beforeAll } from "vitest";
import { PrismaRuntimeStore } from "@/lib/agents/prisma-store";
import { emptyCost } from "@/lib/agents/types";

const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

suite("PrismaRuntimeStore", () => {
  let store: PrismaRuntimeStore;
  let clientId: string;

  beforeAll(async () => {
    store = new PrismaRuntimeStore();
    const client = await store.upsertClient({
      id: "",
      domain: `itest-${Date.now()}.example`,
      brand: "Integration",
      cadenceHours: 24,
      nextRunAt: new Date(Date.now() - 1000).toISOString(),
      costBudget: { maxTokensPerRun: 1000, maxApiCallsPerRun: 10, maxMsPerRun: 60000 },
    });
    clientId = client.id;
  });

  it("round-trips a run with steps", async () => {
    const run = await store.createRun({
      clientId,
      status: "pending",
      trigger: "manual",
      startedAt: new Date().toISOString(),
      budget: { maxMs: 60000, maxTokens: 1000, maxApiCalls: 10 },
      spent: emptyCost(),
    });
    await store.createSteps([
      { runId: run.id, agentName: "observer", ordinal: 0, status: "pending", attempts: 0, cost: emptyCost(), notes: [] },
    ]);

    const next = await store.nextPendingStep(run.id);
    expect(next?.agentName).toBe("observer");

    await store.updateStep(next!.id, { status: "ok", cost: { tokens: 5, apiCalls: 1, ms: 20 } });
    const steps = await store.listSteps(run.id);
    expect(steps[0]!.status).toBe("ok");
    expect(steps[0]!.cost.tokens).toBe(5);
  });

  it("enforces dedupeKey uniqueness per client", async () => {
    const run = await store.createRun({
      clientId,
      status: "running",
      trigger: "cron",
      startedAt: new Date().toISOString(),
      budget: { maxMs: 60000, maxTokens: 1000, maxApiCalls: 10 },
      spent: emptyCost(),
    });

    const base = {
      clientId,
      runId: run.id,
      agentName: "diagnosis" as const,
      kind: "create" as const,
      target: { type: "page-change" as const },
      payload: { title: "x" },
      rationale: "first",
      evidenceIds: [],
      riskTier: "low" as const,
      dedupeKey: "itest:dupe",
      estimatedImpact: "+1",
      effortHours: 1,
      costToProduce: 0.1,
      status: "pending" as const,
    };

    const first = await store.upsertProposal(base);
    const second = await store.upsertProposal({ ...base, rationale: "second" });

    expect(second.id).toBe(first.id);
    expect(second.rationale).toBe("second");
  });
});
```

- [ ] **Step 4: Include integration tests in the Vitest config**

Replace `vitest.config.ts` entirely:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/eval/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/integration/prisma-runtime-store.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/prisma-store"`

- [ ] **Step 6: Write the Prisma store**

Create `lib/agents/prisma-store.ts`:

```ts
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
```

- [ ] **Step 7: Run the integration test**

Run: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/opengrowth" npx vitest run tests/integration/prisma-runtime-store.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 8: Verify the suite still passes without a database**

Run: `npm test`
Expected: PASS, with the integration file reported as skipped

- [ ] **Step 9: Document the env var**

Add to `.env.example` under the existing `DATABASE_URL` line:

```
# Agent runtime. Requires PostgreSQL — Prisma cannot use enums on SQLite.
# docker run --name opengrowth-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=opengrowth -p 5432:5432 -d postgres:16
AGENT_TICK_SECRET=""
AGENT_TICK_MAX_CLIENTS="5"
AGENT_TICK_LEASE_MS="120000"
```

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/agents/prisma-store.ts \
  tests/integration/prisma-runtime-store.test.ts vitest.config.ts .env.example
git commit -m "feat(agents): postgres-backed runtime store"
```

---

### Task 7: Observer agent

**Files:**
- Create: `lib/agents/impl/observer.ts`
- Test: `tests/unit/agent-observer.test.ts`

**Interfaces:**
- Consumes: `Agent`, `RunContext` (Task 3); `StepResult`, `ProposalDraft` (Task 1); `runSeoScan(url, deps)` from `@/lib/engines/run-seo-scan`; `runGeoProbes(input)` from `@/lib/engines/run-geo`
- Produces: `createObserverAgent(deps: ObserverDeps): Agent`, `ObserverDeps = { scan: (url: string) => Promise<ObservedSeo>; probe: (input: { brand: string; domain: string }) => Promise<ObservedGeo>; lastObservation?: (clientId: string) => Promise<ObservedSeo | null> }`

The agent is constructed with injected functions so tests never touch the network. Wiring to the real `runSeoScan` / `runGeoProbes` happens in Task 8.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-observer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createObserverAgent } from "@/lib/agents/impl/observer";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import type { RunContext } from "@/lib/agents/agent";
import { emptyCost } from "@/lib/agents/types";

function ctx(): RunContext {
  const store = new InMemoryRuntimeStore();
  return {
    store,
    now: () => new Date("2026-07-23T12:00:00.000Z"),
    client: {
      id: "c1",
      domain: "dosacc.com",
      brand: "DiligenceOS",
      cadenceHours: 168,
      costBudget: { maxTokensPerRun: 1000, maxApiCallsPerRun: 10, maxMsPerRun: 60000 },
    },
    run: {
      id: "r1",
      clientId: "c1",
      status: "running",
      trigger: "cron",
      startedAt: "2026-07-23T12:00:00.000Z",
      budget: { maxMs: 60000, maxTokens: 1000, maxApiCalls: 10 },
      spent: emptyCost(),
    },
    step: {
      id: "s1",
      runId: "r1",
      agentName: "observer",
      ordinal: 0,
      status: "running",
      attempts: 0,
      cost: emptyCost(),
      notes: [],
    },
  };
}

const seo = { score: 99, pagesScanned: 19, contentHash: "hash-a", issues: ["thin content /us/"] };
const geo = { mentionRate: 0, sampleSize: 6, model: "gemini-flash-latest", citedOthers: ["reddit.com"] };

describe("observer agent", () => {
  it("runs when there is no prior observation", async () => {
    const agent = createObserverAgent({
      scan: async () => seo,
      probe: async () => geo,
      lastObservation: async () => null,
    });
    expect(await agent.shouldRun(ctx())).toEqual({ run: true, reason: "no prior observation" });
  });

  it("skips when the content hash is unchanged", async () => {
    const agent = createObserverAgent({
      scan: async () => seo,
      probe: async () => geo,
      lastObservation: async () => seo,
    });
    const verdict = await agent.shouldRun(ctx());
    expect(verdict.run).toBe(false);
    expect(verdict.reason).toBe("no crawl delta since last observation");
  });

  it("proposes an observation carrying seo and geo readings", async () => {
    const agent = createObserverAgent({ scan: async () => seo, probe: async () => geo });
    const result = await agent.execute(ctx());

    expect(result.status).toBe("ok");
    expect(result.proposals.length).toBe(1);
    const proposal = result.proposals[0]!;
    expect(proposal.target.type).toBe("observation");
    expect(proposal.dedupeKey).toBe("observation:2026-07-23");
    expect(proposal.riskTier).toBe("low");
    expect(proposal.payload).toEqual({ seo, geo });
    expect(result.cost.apiCalls).toBe(2);
  });

  it("degrades to skipped when the geo provider fails", async () => {
    const agent = createObserverAgent({
      scan: async () => seo,
      probe: async () => {
        throw new Error("Gemini HTTP 429");
      },
    });
    const result = await agent.execute(ctx());

    expect(result.status).toBe("skipped");
    expect(result.notes[0]).toContain("Gemini HTTP 429");
    expect(result.proposals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-observer.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/impl/observer"`

- [ ] **Step 3: Write the implementation**

Create `lib/agents/impl/observer.ts`:

```ts
/**
 * Observer — records what the world currently looks like.
 *
 * Skipping cheaply is the point: most ticks find no crawl delta and must cost
 * nothing. A provider failure degrades the step to `skipped`, never `failed` —
 * Gemini 429s are routine and must not block a run.
 */

import type { Agent, RunContext, ShouldRunVerdict } from "@/lib/agents/agent";
import type { ProposalDraft, StepResult } from "@/lib/agents/types";

export interface ObservedSeo {
  score: number;
  pagesScanned: number;
  contentHash: string;
  issues: string[];
}

export interface ObservedGeo {
  mentionRate: number;
  sampleSize: number;
  model: string;
  citedOthers: string[];
}

export interface ObserverDeps {
  scan: (url: string) => Promise<ObservedSeo>;
  probe: (input: { brand: string; domain: string }) => Promise<ObservedGeo>;
  lastObservation?: (clientId: string) => Promise<ObservedSeo | null>;
}

export function createObserverAgent(deps: ObserverDeps): Agent {
  return {
    name: "observer",
    costClass: "expensive",

    async shouldRun(ctx: RunContext): Promise<ShouldRunVerdict> {
      if (!deps.lastObservation) return { run: true, reason: "no observation history" };

      const previous = await deps.lastObservation(ctx.client.id);
      if (!previous) return { run: true, reason: "no prior observation" };

      const current = await deps.scan(`https://${ctx.client.domain}/`);
      if (current.contentHash === previous.contentHash) {
        return { run: false, reason: "no crawl delta since last observation" };
      }
      return { run: true, reason: "crawl delta detected" };
    },

    async execute(ctx: RunContext): Promise<StepResult> {
      const started = ctx.now().getTime();

      let seo: ObservedSeo;
      let geo: ObservedGeo;
      try {
        seo = await deps.scan(`https://${ctx.client.domain}/`);
        geo = await deps.probe({ brand: ctx.client.brand, domain: ctx.client.domain });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          status: "skipped",
          proposals: [],
          cost: { tokens: 0, apiCalls: 1, ms: ctx.now().getTime() - started },
          notes: [`Observation degraded: ${message}`],
        };
      }

      const day = ctx.now().toISOString().slice(0, 10);
      const proposal: ProposalDraft = {
        kind: "create",
        target: { type: "observation" },
        payload: { seo, geo },
        rationale: `SEO ${seo.score}/100 across ${seo.pagesScanned} pages; answer mention rate ${(geo.mentionRate * 100).toFixed(0)}% on n=${geo.sampleSize} (${geo.model}).`,
        evidenceIds: [],
        riskTier: "low",
        dedupeKey: `observation:${day}`,
        estimatedImpact: "Baseline reading — no direct impact",
        effortHours: 0,
        costToProduce: 0,
      };

      return {
        status: "ok",
        proposals: [proposal],
        cost: { tokens: 0, apiCalls: 2, ms: ctx.now().getTime() - started },
        notes: [`Scanned ${seo.pagesScanned} pages`, `GEO sample n=${geo.sampleSize}`],
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-observer.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/agents/impl/observer.ts tests/unit/agent-observer.test.ts
git commit -m "feat(agents): observer agent with cheap skip and graceful degradation"
```

---

### Task 8: Live agent wiring

**Files:**
- Create: `lib/agents/wiring.ts`
- Test: `tests/unit/agent-wiring.test.ts`

**Interfaces:**
- Consumes: `createObserverAgent`, `ObservedSeo`, `ObservedGeo` (Task 7); `createRegistry` (Task 3); `runSeoScan` from `@/lib/engines/run-seo-scan`; `runGeoProbes` from `@/lib/engines/run-geo`
- Produces: `buildLiveRegistry(): AgentRegistry`, `LIVE_PIPELINE: AgentName[]`, `hashPages(pages: { url: string; title: string }[]): string`

Only `observer` is registered in this plan. Tasks in the follow-on plan register the remaining six and extend `LIVE_PIPELINE`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-wiring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLiveRegistry, hashPages, LIVE_PIPELINE } from "@/lib/agents/wiring";

describe("agent wiring", () => {
  it("registers the observer agent", () => {
    expect(buildLiveRegistry().has("observer")).toBe(true);
  });

  it("exposes a pipeline containing only registered agents", () => {
    const registry = buildLiveRegistry();
    for (const name of LIVE_PIPELINE) {
      expect(registry.has(name)).toBe(true);
    }
  });

  it("hashes page identity stably regardless of order", () => {
    const a = hashPages([
      { url: "/", title: "Home" },
      { url: "/us/", title: "US" },
    ]);
    const b = hashPages([
      { url: "/us/", title: "US" },
      { url: "/", title: "Home" },
    ]);
    expect(a).toBe(b);
  });

  it("changes the hash when a title changes", () => {
    const a = hashPages([{ url: "/", title: "Home" }]);
    const b = hashPages([{ url: "/", title: "Home v2" }]);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-wiring.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/wiring"`

- [ ] **Step 3: Write the implementation**

Create `lib/agents/wiring.ts`:

```ts
/**
 * Binds agents to the real engines. This is the only file that knows both the
 * agent contract and the concrete providers, which keeps agents testable.
 */

import { createHash } from "node:crypto";
import { createObserverAgent } from "@/lib/agents/impl/observer";
import type { ObservedGeo, ObservedSeo } from "@/lib/agents/impl/observer";
import { createRegistry } from "@/lib/agents/registry";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { AgentName } from "@/lib/agents/types";
import { runSeoScan } from "@/lib/engines/run-seo-scan";
import { runGeoProbes } from "@/lib/engines/run-geo";

/** Agents registered so far. Extended as the remaining six land. */
export const LIVE_PIPELINE: AgentName[] = ["observer"];

export function hashPages(pages: { url: string; title: string }[]): string {
  const canonical = pages
    .map((page) => `${page.url} ${page.title}`)
    .sort()
    .join("");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

async function scan(url: string): Promise<ObservedSeo> {
  const result = await runSeoScan(url);
  return {
    score: result.score,
    pagesScanned: result.pages.length,
    contentHash: hashPages(result.pages.map((p) => ({ url: p.url, title: p.title ?? "" }))),
    issues: result.siteIssues.map((issue) => String(issue)),
  };
}

async function probe(input: { brand: string; domain: string }): Promise<ObservedGeo> {
  const result = await runGeoProbes({ brand: input.brand, domain: input.domain });
  return {
    mentionRate: result.brandMentionRate,
    sampleSize: result.sampleSize,
    model: result.model,
    citedOthers: result.observations
      .flatMap((observation) => observation.citations.map((citation) => citation.domain))
      .filter((domain): domain is string => Boolean(domain)),
  };
}

export function buildLiveRegistry(): AgentRegistry {
  return createRegistry([createObserverAgent({ scan, probe })]);
}
```

- [ ] **Step 4: Verify the engine signatures match**

Run: `npm run typecheck`
Expected: PASS. If `runSeoScan`'s result field names differ from `score` / `pages` / `siteIssues`, or `runGeoProbes`' from `brandMentionRate` / `sampleSize` / `model` / `observations`, read `lib/engines/run-seo-scan.ts:82-87` and `lib/engines/run-geo.ts:10-34` and adjust the two adapter functions only — do not change the engines.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-wiring.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add lib/agents/wiring.ts tests/unit/agent-wiring.test.ts
git commit -m "feat(agents): wire observer to live crawl and geo engines"
```

---

### Task 9: Authenticated tick endpoint and local driver

**Files:**
- Create: `app/api/agent/tick/route.ts`
- Create: `lib/agents/tick.ts`
- Create: `scripts/tick.ts`
- Modify: `package.json:5-11` (scripts block)
- Test: `tests/unit/agent-tick.test.ts`

**Interfaces:**
- Consumes: `RuntimeStore` (Task 1), `AgentRegistry` (Task 3), `startRun`, `advanceRun` (Task 5)
- Produces: `runTick(deps: TickDeps): Promise<TickReport>` where `TickDeps = { store; registry; pipeline; now?; maxClients?; leaseMs? }` and `TickReport = { claimed: number; advanced: { clientId: string; runId: string; stepsExecuted: number; stopReason: string }[] }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-tick.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { createRegistry } from "@/lib/agents/registry";
import { runTick } from "@/lib/agents/tick";
import type { Agent } from "@/lib/agents/agent";
import { emptyCost } from "@/lib/agents/types";

const agent: Agent = {
  name: "observer",
  costClass: "cheap",
  async shouldRun() {
    return { run: true, reason: "test" };
  },
  async execute() {
    return {
      status: "ok",
      proposals: [],
      cost: { tokens: 1, apiCalls: 1, ms: 1 },
      notes: [],
    };
  },
};

async function seed(store: InMemoryRuntimeStore, id: string, nextRunAt: string) {
  await store.upsertClient({
    id,
    domain: `${id}.example`,
    brand: id,
    cadenceHours: 24,
    nextRunAt,
    costBudget: { maxTokensPerRun: 100, maxApiCallsPerRun: 10, maxMsPerRun: 60_000 },
  });
}

const now = () => new Date("2026-07-23T12:00:00.000Z");

describe("runTick", () => {
  it("claims due clients, starts runs, and advances them", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "due", "2026-07-23T11:00:00.000Z");
    const registry = createRegistry([agent]);

    const report = await runTick({ store, registry, pipeline: ["observer"], now });

    expect(report.claimed).toBe(1);
    expect(report.advanced[0]!.stepsExecuted).toBe(1);
    expect(report.advanced[0]!.stopReason).toBe("pipeline complete");
  });

  it("ignores clients that are not yet due", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "later", "2026-07-23T18:00:00.000Z");
    const registry = createRegistry([agent]);

    const report = await runTick({ store, registry, pipeline: ["observer"], now });
    expect(report.claimed).toBe(0);
    expect(report.advanced).toEqual([]);
  });

  it("continues an existing open run instead of starting a second one", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "open", "2026-07-23T11:00:00.000Z");
    const client = (await store.getClient("open"))!;
    const existing = await store.createRun({
      clientId: client.id,
      status: "running",
      trigger: "cron",
      startedAt: "2026-07-23T10:00:00.000Z",
      budget: { maxMs: 60_000, maxTokens: 100, maxApiCalls: 10 },
      spent: emptyCost(),
    });
    await store.createSteps([
      { runId: existing.id, agentName: "observer", ordinal: 0, status: "pending", attempts: 0, cost: emptyCost(), notes: [] },
    ]);

    const registry = createRegistry([agent]);
    const report = await runTick({ store, registry, pipeline: ["observer"], now });

    expect(report.advanced[0]!.runId).toBe(existing.id);
  });

  it("schedules the next run when a run completes", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "resched", "2026-07-23T11:00:00.000Z");
    const registry = createRegistry([agent]);

    await runTick({ store, registry, pipeline: ["observer"], now });

    const client = (await store.getClient("resched"))!;
    expect(client.nextRunAt).toBe("2026-07-24T12:00:00.000Z");
  });

  it("respects maxClients", async () => {
    const store = new InMemoryRuntimeStore();
    await seed(store, "a", "2026-07-23T11:00:00.000Z");
    await seed(store, "b", "2026-07-23T11:00:00.000Z");
    const registry = createRegistry([agent]);

    const report = await runTick({ store, registry, pipeline: ["observer"], now, maxClients: 1 });
    expect(report.claimed).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-tick.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/tick"`

- [ ] **Step 3: Write the tick orchestration**

Create `lib/agents/tick.ts`:

```ts
/**
 * One tick: claim due clients, advance each within budget, reschedule.
 *
 * Idempotent by lease. A crashed tick releases its clients when the lease
 * expires, so the next tick picks them up without duplicate work.
 */

import { advanceRun, startRun } from "@/lib/agents/runner";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { RuntimeStore } from "@/lib/agents/store";
import type { AgentName } from "@/lib/agents/types";

export interface TickDeps {
  store: RuntimeStore;
  registry: AgentRegistry;
  pipeline: AgentName[];
  now?: () => Date;
  maxClients?: number;
  leaseMs?: number;
}

export interface TickReport {
  claimed: number;
  advanced: {
    clientId: string;
    runId: string;
    stepsExecuted: number;
    stopReason: string;
  }[];
}

export async function runTick(deps: TickDeps): Promise<TickReport> {
  const now = deps.now ?? (() => new Date());
  const maxClients = deps.maxClients ?? 5;
  const leaseMs = deps.leaseMs ?? 120_000;

  const clients = await deps.store.claimDueClients(now(), maxClients, leaseMs);
  const advanced: TickReport["advanced"] = [];

  for (const client of clients) {
    const open = await deps.store.openRunForClient(client.id);
    const run = open ?? (await startRun(deps.store, client, "cron", deps.pipeline));

    const result = await advanceRun({
      store: deps.store,
      registry: deps.registry,
      client,
      run,
      now,
    });

    if (result.run.status === "done") {
      await deps.store.upsertClient({
        ...client,
        leaseUntil: undefined,
        nextRunAt: new Date(
          now().getTime() + client.cadenceHours * 60 * 60 * 1000,
        ).toISOString(),
      });
    }

    advanced.push({
      clientId: client.id,
      runId: result.run.id,
      stepsExecuted: result.stepsExecuted,
      stopReason: result.stopReason,
    });
  }

  return { claimed: clients.length, advanced };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-tick.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Write the HTTP route**

Create `app/api/agent/tick/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaRuntimeStore } from "@/lib/agents/prisma-store";
import { runTick } from "@/lib/agents/tick";
import { buildLiveRegistry, LIVE_PIPELINE } from "@/lib/agents/wiring";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.AGENT_TICK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AGENT_TICK_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await runTick({
      store: new PrismaRuntimeStore(),
      registry: buildLiveRegistry(),
      pipeline: LIVE_PIPELINE,
      maxClients: Number(process.env.AGENT_TICK_MAX_CLIENTS ?? 5),
      leaseMs: Number(process.env.AGENT_TICK_LEASE_MS ?? 120_000),
    });
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tick failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write the local driver**

Create `scripts/tick.ts`:

```ts
/** Local tick driver: `npm run tick`. Requires DATABASE_URL. */

import { PrismaRuntimeStore } from "@/lib/agents/prisma-store";
import { runTick } from "@/lib/agents/tick";
import { buildLiveRegistry, LIVE_PIPELINE } from "@/lib/agents/wiring";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Start Postgres and export it.");
    process.exit(1);
  }
  const report = await runTick({
    store: new PrismaRuntimeStore(),
    registry: buildLiveRegistry(),
    pipeline: LIVE_PIPELINE,
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 7: Add the npm script**

In `package.json`, add to the `scripts` block after `"test:e2e"`:

```json
"tick": "npx tsx --tsconfig tsconfig.json scripts/tick.ts"
```

Then install the runner:

```bash
npm install --save-dev tsx
```

- [ ] **Step 8: Verify the route compiles**

Run: `npm run typecheck && npm run lint`
Expected: PASS with no errors and no warnings

- [ ] **Step 9: Commit**

```bash
git add lib/agents/tick.ts app/api/agent/tick/route.ts scripts/tick.ts \
  package.json package-lock.json tests/unit/agent-tick.test.ts
git commit -m "feat(agents): authenticated tick endpoint and local driver"
```

---

### Task 10: Import the existing DiligenceOS workspace

**Files:**
- Create: `lib/agents/import-workspace.ts`
- Create: `scripts/import-workspace.ts`
- Modify: `package.json:5-12` (scripts block)
- Test: `tests/unit/agent-import-workspace.test.ts`

**Interfaces:**
- Consumes: `RuntimeStore`, `ClientRecord` (Task 1); `MarketingWorkspace` from `@/lib/marketing/workspace`
- Produces: `clientFromWorkspace(ws: Pick<MarketingWorkspace, "domain" | "brand">, now: Date): ClientRecord`, `importWorkspace(store, ws, now): Promise<ClientRecord>`

Existing `.data/marketing-workspaces/*.json` state is not deleted by this task. The old file store keeps working until the Operator Console plan replaces its readers.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/agent-import-workspace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InMemoryRuntimeStore } from "@/lib/agents/store";
import { clientFromWorkspace, importWorkspace } from "@/lib/agents/import-workspace";

const ws = { domain: "dosacc.com", brand: "DiligenceOS" };
const now = new Date("2026-07-23T12:00:00.000Z");

describe("workspace import", () => {
  it("derives a client with a weekly cadence due immediately", () => {
    const client = clientFromWorkspace(ws, now);
    expect(client.domain).toBe("dosacc.com");
    expect(client.brand).toBe("DiligenceOS");
    expect(client.cadenceHours).toBe(168);
    expect(client.nextRunAt).toBe("2026-07-23T12:00:00.000Z");
  });

  it("applies conservative default cost budgets", () => {
    const client = clientFromWorkspace(ws, now);
    expect(client.costBudget).toEqual({
      maxTokensPerRun: 50_000,
      maxApiCallsPerRun: 40,
      maxMsPerRun: 120_000,
    });
  });

  it("persists the client so a tick can claim it", async () => {
    const store = new InMemoryRuntimeStore();
    const client = await importWorkspace(store, ws, now);

    expect(await store.getClient(client.id)).not.toBeNull();
    const claimed = await store.claimDueClients(now, 5, 60_000);
    expect(claimed.map((c) => c.domain)).toContain("dosacc.com");
  });

  it("is idempotent for the same domain", async () => {
    const store = new InMemoryRuntimeStore();
    await importWorkspace(store, ws, now);
    await importWorkspace(store, ws, now);
    const claimed = await store.claimDueClients(now, 10, 60_000);
    expect(claimed.filter((c) => c.domain === "dosacc.com").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/agent-import-workspace.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/agents/import-workspace"`

- [ ] **Step 3: Write the implementation**

Create `lib/agents/import-workspace.ts`:

```ts
/**
 * One-shot migration from the legacy `.data/marketing-workspaces` blob store
 * into the agent runtime. Only client identity and cadence move; packs and
 * approvals stay where they are until the Operator Console plan replaces their
 * readers.
 */

import type { RuntimeStore } from "@/lib/agents/store";
import type { ClientRecord } from "@/lib/agents/types";

export interface WorkspaceIdentity {
  domain: string;
  brand: string;
}

export function clientFromWorkspace(ws: WorkspaceIdentity, now: Date): ClientRecord {
  return {
    id: `client-${ws.domain}`,
    domain: ws.domain,
    brand: ws.brand,
    cadenceHours: 168,
    nextRunAt: now.toISOString(),
    costBudget: {
      maxTokensPerRun: 50_000,
      maxApiCallsPerRun: 40,
      maxMsPerRun: 120_000,
    },
  };
}

export async function importWorkspace(
  store: RuntimeStore,
  ws: WorkspaceIdentity,
  now: Date,
): Promise<ClientRecord> {
  return store.upsertClient(clientFromWorkspace(ws, now));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/agent-import-workspace.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Write the import script**

Create `scripts/import-workspace.ts`:

```ts
/** Import every legacy workspace into the runtime: `npm run import:workspaces`. */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaRuntimeStore } from "@/lib/agents/prisma-store";
import { importWorkspace } from "@/lib/agents/import-workspace";

const DIR = join(process.cwd(), ".data", "marketing-workspaces");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const store = new PrismaRuntimeStore();
  const now = new Date();
  let files: string[] = [];
  try {
    files = (await readdir(DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("No legacy workspaces found — nothing to import.");
    return;
  }

  for (const file of files) {
    const raw = JSON.parse(await readFile(join(DIR, file), "utf8")) as {
      domain: string;
      brand: string;
    };
    const client = await importWorkspace(store, { domain: raw.domain, brand: raw.brand }, now);
    console.log(`Imported ${client.domain} as ${client.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 6: Add the npm script**

In `package.json`, add after `"tick"`:

```json
"import:workspaces": "npx tsx --tsconfig tsconfig.json scripts/import-workspace.ts"
```

- [ ] **Step 7: Run the full verification suite**

Run:
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all PASS, zero warnings

- [ ] **Step 8: Prove the loop end to end**

Run:
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/opengrowth"
npm run import:workspaces
npm run tick
```
Expected: the import prints `Imported dosacc.com as ...`, and the tick prints a report with `claimed: 1` and one entry in `advanced` whose `stopReason` is `pipeline complete`.

- [ ] **Step 9: Commit**

```bash
git add lib/agents/import-workspace.ts scripts/import-workspace.ts package.json \
  tests/unit/agent-import-workspace.test.ts
git commit -m "feat(agents): import legacy workspaces into the runtime"
```

---

## What this plan does not cover

Two follow-on plans complete sub-project 1 as specced. Both depend on the contracts frozen here.

**Plan B — the remaining six agents.** Onboarding (builds the Vertical Model from `business-graph`, `prompt-derive`, `live-intelligence`), Diagnosis, Strategist, Packager, Compliance, Reporter. Each registers in `lib/agents/wiring.ts` and extends `LIVE_PIPELINE`. This plan also decomposes `lib/marketing/deep-engine.ts` (766 lines) and `lib/marketing/os.ts` (893 lines) into thin agents over pure generators.

**Plan C — the Operator Console.** Rebuilds `components/marketing/marketing-os-dashboard.tsx` and the four `app/demo/marketing/*` pages as a queue-driven surface reading real runs, steps, proposals and cost-to-serve, replacing the fabricated `agentLog`. Includes approve/reject wiring against `setProposalStatus`.

They are separate plans because each produces working, testable software on its own, and because Plan C's UI should be built against a runtime whose shape has been proven by Plan B.
