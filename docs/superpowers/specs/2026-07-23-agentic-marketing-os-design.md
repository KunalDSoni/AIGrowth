# Agentic Marketing OS — Agency Production Engine — Design

**Date:** 2026-07-23
**Status:** Approved (user: "GO START BUILDING")
**Product:** OpenGrowth AI Engine
**Slice:** Sub-project 1 of 4 — Agent Runtime, durable state, Operator Console

## Decision

The Marketing OS is **not a SaaS product we sell**. It is the production engine of an
AI-native agency that sells marketing outcomes. Customer zero is DiligenceOS
(`dosacc.com`, accounting outsourcing, US + AU markets). The platform itself is
industry-agnostic.

Rationale from market research (July 2026):

- Profound holds the AI-visibility category: $155M raised, $1B valuation, Fortune 500
  logos, $399–499/mo entry and $2,000+/mo enterprise. Monitoring is commoditising and
  Semrush/Ahrefs/Conductor already bundle it.
- Every GEO vendor fails at the same two things: **execution** ("monitoring alone does
  not change outcomes") and **attribution** (55.9% of AI-influenced visits never appear
  as AI referrals).
- The martech landscape holds 15,384 tools. A new tool is invisible; a delivered outcome
  is not.
- 90.3% of teams use AI agents somewhere but only 23.3% run them in full production —
  80.6% are assist-only. Propose-and-approve is where the market actually is.
- Y Combinator added AI-native agencies to its 2026 Request for Startups. Daydream raised
  a $15M Series A for exactly this model. Agency margins move from 20–35% to 65–80% when
  AI is the production engine.

Deferred deliberately: SSO, SCIM, procurement, data residency, self-serve onboarding,
billing, multi-region. None of these serve an agency running its own delivery.

## Operating metric

**Clients per operator.** Manual delivery in this category runs 1 strategist per 3–5
clients. The margin thesis requires 15–25. Every design decision is judged against that
number, not against feature parity with Profound.

Three consequences, binding on the design:

1. The operator surface is a **prioritised queue**, not a per-client dashboard. A client
   nobody thinks about is the system working correctly.
2. **Cost-to-serve is a first-class metric.** Every agent action records tokens, API calls
   and human review minutes, attributed per client. Margin is measured or imaginary.
3. **Vertical packs are the compounding asset.** What the Onboarding agent learns for
   client #1 makes client #2 in the same vertical cost ~20% as much to onboard.

## Hard rule

> If a feature ever needs `if (industry === "accounting")`, it belongs in the Vertical
> Model, not in code.

| DiligenceOS-specific | General mechanism |
|---|---|
| "best outsourced accounting firms for CPA firms" | Prompt universe (ICP × job × objection × market) |
| US vs AU, 1040 vs BAS, IRS vs ATO | Market model (locale, regulator, platform ecosystem, glossary) |
| SOC 2, IRS §7216, TPB, Privacy Act APP 8 | Trust model (claim classes, required proof, jurisdiction) |
| AccountingWEB, r/Accounting, Xero directory | Citation supply chain (discovered from live answers) |
| Busy season, EOFY, BAS quarters | Seasonality model |
| Entigrity, QX, TOA Global | Competitive set (discovered by co-citation) |

## Architecture

Three surfaces, clearly bounded:

```text
Cron ─► POST /api/agent/tick (authenticated)
          │  claim due clients, advance runs within time + cost budget
          ▼
      Agent Runtime (headless)
          │  Observer → Onboarding → Diagnosis → Strategist → Packager → Compliance → Reporter
          │  each step emits Proposals + CostRecord, never mutates client artifacts
          ▼
      Proposal queue ──► Operator Console (internal, queue-driven)
                            │  approve / reject / edit
                            ▼
                        Artifact + ArtifactVersion ──► Client Portal (read-only proof)
```

Data flows one way. Outcomes feed back into the Vertical Model and the Strategist's
priors.

## Agent contract

```ts
interface Agent {
  name: AgentName;
  costClass: "cheap" | "moderate" | "expensive";
  shouldRun(ctx: RunContext): Promise<{ run: boolean; reason: string }>;
  execute(ctx: RunContext): Promise<StepResult>;
}

interface StepResult {
  status: "ok" | "skipped" | "failed" | "needs_input";
  proposals: Proposal[];
  cost: { tokens: number; apiCalls: number; ms: number };
  notes: string[];
}
```

`shouldRun` is load-bearing for margin: it must decide without spending tokens. An
Observer that sees no crawl delta since the last run skips for free, and that is the
common case.

No agent knows its industry or its client. Both arrive via `RunContext`.

## Proposals

Agents never mutate client artifacts. Every output is a proposal a human accepts.

```ts
interface Proposal {
  id: string; clientId: string; runId: string; agentName: AgentName;
  kind: "create" | "update" | "retire";
  target: { type: "asset" | "pack" | "outreach" | "page-change" | "vertical-model"; id?: string };
  payload: unknown;
  rationale: string;
  evidenceIds: string[];
  riskTier: "low" | "medium" | "high";
  dedupeKey: string;
  estimatedImpact: string; effortHours: number; costToProduce: number;
  status: "pending" | "accepted" | "rejected" | "superseded";
}
```

`dedupeKey` is the anti-pileup mechanism: a tick that rediscovers a known gap **updates
the existing pending proposal** rather than stacking a duplicate into the queue. Rejected
proposals keep their key, so the same finding is not re-proposed after a human has said no.

## Runs

A `Run` belongs to one client and carries both a time budget and a **cost budget**. The
tick endpoint claims due clients, advances each by as many `RunStep`s as fit those
budgets, persists, and returns. Steps are the resumption unit — a crawl timeout in step 2
never discards step 1's work.

Run status: `pending | running | blocked | done | failed`.
Step status: `pending | running | ok | skipped | failed | needs_input`.

## Persistence

Prisma. SQLite in development, PostgreSQL in production. This retires the existing
"schema written but unused" debt.

Tables: `Client`, `VerticalModel`, `Run`, `RunStep`, `Proposal`, `Artifact`,
`ArtifactVersion`, `Observation`, `Evidence`, `CostRecord`, `ApprovalEvent`.

The current `.data/marketing-workspaces/*.json` blob store is replaced. A one-shot
importer migrates the existing DiligenceOS workspace so no live state is lost.

## What this fixes in the current code

`generateWorkspace()` in `lib/marketing/workspace.ts` rebuilds the entire workspace on
every call, clobbering approvals, pack edits and outreach statuses. `regeneratePack()`
re-runs the whole deep engine to replace one pack. `agentLog` entries and pod statuses are
fabricated at write time rather than recorded from execution, and `nextLoopAt` is written
but never read.

The proposal model makes destructive regeneration structurally impossible.

Two files must decompose. `lib/marketing/deep-engine.ts` (766 lines) and
`lib/marketing/os.ts` (893 lines) currently mix orchestration, generation, rendering and
demo fixtures. They split into thin agents that call pure generators, with rendering
moved to `lib/marketing/report-html.ts` and its siblings.

## Existing engines become agent internals

| Agent | Wraps |
|---|---|
| Observer | `run-seo-scan`, `crawler`, `run-geo`, `geo-metrics` |
| Onboarding | `business-graph`, `prompt-derive`, `live-intelligence`, `site-inventory` |
| Diagnosis | `citation-gap`, `live-citation-gaps`, `competitor-intelligence` |
| Strategist | `next-actions`, `recommendation-bus`, `priority` |
| Packager | `deep-engine` (decomposed), `campaign`, `brief-builder` |
| Compliance | `claim-validation` |
| Reporter | `report-html`, `audit-report` |

No engine is rewritten. Each is called from an agent that owns scheduling, cost accounting
and proposal emission.

## Scope of this spec

**In scope — Sub-project 1:**

- Prisma schema, migrations, and the repository layer for the tables above
- Agent registry and the `Agent` / `StepResult` / `Proposal` contracts
- Resumable run/step machine with time and cost budgets
- Authenticated `POST /api/agent/tick` plus an `npm run tick` local driver
- Seven agents: Observer, Onboarding, Diagnosis, Strategist, Packager, Compliance, Reporter
- Cost Governor: per-client budgets, hard spend limits, cost-to-serve reporting
- Importer for the existing `.data` workspace
- Operator Console: rebuild `components/marketing/marketing-os-dashboard.tsx` and the four
  `app/demo/marketing/*` pages as a queue-driven surface reading real runs, steps,
  proposals and costs — replacing the fabricated `agentLog`

**Out of scope — later sub-projects:**

2. Publishing & rollback (CMS/GBP write paths, versioned revert)
3. Paid, lifecycle and outreach distribution agents (needs connectors)
4. Attribution & incrementality (geo-holdouts, LLM-referral modelling), Client Portal

## Paid, when we reach sub-project 3

Recorded here so the runtime is not designed against it. We do not compete with Google AI
Max or Meta Advantage+ inside their own auctions. We own cross-platform budget allocation,
creative supply, conversion path, compliance enforcement on every ad, and — critically —
**incrementality measurement via geo- and spend-holdouts**, which is what makes the
answer-presence number provable. Paid runs at a distinct autonomy tier: free reallocation
inside a human-approved budget envelope, approval required for envelope changes, new
creative and new audiences. Hard spend limits are enforced by the Cost Governor.

## Error handling

- A failed step records its error and increments a retry count; three failures block the
  run and raise an operator escalation rather than looping.
- Provider failures (Gemini 429s are already common in the DiligenceOS data) mark the step
  `skipped` with a reason, not `failed`. The run continues.
- Cost-budget exhaustion pauses the run at a step boundary and resumes on the next tick.
- Ticks are idempotent: claiming uses a lease with an expiry so a crashed tick releases
  its clients.

## Testing

- Unit: each agent's `shouldRun` and `execute` against fixture `RunContext`s, including
  the skip paths that protect margin.
- Unit: `dedupeKey` behaviour — rediscovery updates rather than duplicates, and rejection
  suppresses re-proposal.
- Integration: a full run advanced across multiple ticks, asserting resumption after an
  injected mid-run failure loses no completed steps.
- Integration: cost accounting sums to the run total and respects hard limits.
- E2E (Playwright): operator approves a proposal, artifact version appears, queue empties.

## Honesty constraints

Carried forward from existing product principles. GEO results remain directional samples,
not rankings. Estimates stay labelled as estimates. No generated asset publishes without
human review. Cost figures are actuals, never projections.
