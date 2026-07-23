# OpenGrowth Marketing Brain Keystone — Design Spec

**Date:** 2026-07-23  
**Status:** Ready for implementation planning (user asked to write + push; will take further)  
**Product:** OpenGrowth AI Engine  
**Slice:** Sub-project 1 — Brand Knowledge Graph + Evidence Graph + Strategist → GTM Program  
**Related:** `2026-07-23-agentic-marketing-os-design.md` (agency production engine / operator queue)

---

## 1. Problem

Current Marketing OS output is **template theater**: long drafts that read like Mad Libs, thin Position Report narrative, duplicate packs, facts listed but barely used. Competitors either **monitor** (Profound, Peec, Otterly) or **automate without SEO+GEO truth** (Clay, Copy.ai, Agentforce) or **run agent orgs without claim-safety** (OpenCMO, opensoul). AdTech and MarTech are converging into MadTech; OpenGrowth must sit as the **Marketing Brain** that grounds strategy in evidence and plugs into existing stacks — not as another thin campaign generator.

## 2. North-star positioning

> OpenGrowth is the open-source **Marketing Brain** for the MadTech era: Brand Knowledge Graph + evidence-grounded strategy that orchestrates SEO, GEO, content, email, social, ABM, PR, and paid — with claim safety and measurement — then activates into existing MarTech/AdTech rather than replacing CDP/DSP overnight.

**Wedge vs market:**

| Layer | Players | Their gap | Our wedge |
|---|---|---|---|
| GEO monitors | Profound, Peec, Otterly | Diagnose only | Diagnose → draft → approve → measure → learn |
| Agentic GTM SaaS | Tofu, Copy.ai, Clay, Salesforce Agentforce | Closed; weak SEO+GEO evidence | Open; crawl+GEO native; claim-gated |
| OSS agents | OpenCMO, opensoul, adclaw | Thin claim-safety / measurement | Evidence graph + claim-gate + learning |
| MarTech | HubSpot, Adobe, Marketo, Braze, Segment | Orchestration without SEO+GEO brain | Brain that drives their stack |
| AdTech | DSPs / ad platforms | Buy media without brand memory | Strategy + Brand KG + paid briefs |

## 3. Scope of this keystone (in / out)

### In (build next)

1. **Brand Knowledge Graph (BKG)** — persistent org memory: positioning, ICP, messaging pillars, tone, banned claims, proof assets, product lines, markets.
2. **Evidence Graph** — typed nodes from crawl/GEO/citations/competitors/org-input; every claim cites node IDs.
3. **Strategist reasoning** — Position narrative + ranked opportunities → **GTM Program** (`Program → Campaign → Play → Asset → Task → MeasurementContract`).
4. **Claim gate** — extend existing `claim-validation`; block approve on unsourced quantitative claims.
5. **Versioned snapshots** — immutable program/report artifacts (reuse object-store pattern).
6. **MadTech seams (interfaces only)** — Profile/Event, Paid brief adapter, Measurement contract, Consent flag, DAM asset refs, CRM export. Stubs until credentials.

### Out (later sub-projects)

- Full CDP / identity resolution / clean rooms  
- Live DSP bidding or ad serving  
- Full multi-agent org chart runtime (covered partly by agency OS spec)  
- SSO / SCIM / billing  
- Replacing HubSpot/Marketo  

## 4. Architecture

```text
AnalyzeResult + OrgBrief (optional)
        │
        ▼
┌───────────────────┐     ┌────────────────────┐
│ Evidence Graph    │────►│ Brand Knowledge    │
│ (crawl/GEO/cite…) │     │ Graph (persistent) │
└───────────────────┘     └────────────────────┘
        │                           │
        └──────────┬────────────────┘
                   ▼
         Strategist Engine
         (deterministic floor + optional Gemini)
                   │
                   ▼
         GTM Program + Position Narrative
                   │
                   ▼
         Claim Gate → Versioned Snapshot Store
                   │
                   ▼
         MadTech seams (Profile / Paid / CRM / DAM / Consent)
```

### Module layout (proposed)

```text
lib/gtm/
  evidence/graph.ts
  brand/knowledge-graph.ts
  brand/store.ts
  model/types.ts                 # Program, Campaign, Play, Asset, Task, MeasurementContract
  input/org-brief.ts
  playbooks/registry.ts
  orchestrate/dependencies.ts    # DAG
  orchestrate/calendar.ts
  orchestrate/budget.ts
  orchestrate/program.ts         # buildProgram(...)
  qa/claim-gate.ts
  seams/profile.ts
  seams/paid-brief.ts
  seams/crm-export.ts
  seams/dam.ts
  seams/consent.ts
  store/program-store.ts
```

Reuse existing: `lib/marketing/deep-engine.ts`, `lib/engines/claim-validation.ts`, `lib/storage/object-store.ts`, `lib/providers/gemini-visibility.ts`, workspace persistence patterns.

## 5. Core data models

### EvidenceNode

```ts
type EvidenceKind =
  | "crawl_page" | "seo_issue" | "geo_observation"
  | "citation" | "competitor" | "org_input" | "outcome";

interface EvidenceNode {
  id: string;
  kind: EvidenceKind;
  summary: string;
  sourceRef: string;       // URL, observation id, etc.
  confidence: "high" | "medium" | "low" | "directional";
  capturedAt: string;
  payload?: Record<string, unknown>;
}
```

### BrandKnowledgeGraph

```ts
interface BrandKnowledgeGraph {
  orgId: string;
  domain: string;
  updatedAt: string;
  positioning: { statement: string; evidenceIds: string[] };
  icp: { segments: string[]; jobsToBeDone: string[]; evidenceIds: string[] };
  messagingPillars: { id: string; title: string; proof: string[]; evidenceIds: string[] }[];
  tone: { voice: string; do: string[]; dont: string[] };
  bannedClaims: string[];
  proofAssets: { id: string; kind: string; title: string; url?: string; verified: boolean }[];
  productLines: string[];
  markets: string[];
  assumptions: string[];   // flagged when org brief missing
}
```

### GTM Program

```ts
interface GtmProgram {
  id: string;
  brand: string;
  domain: string;
  horizonDays: number;
  objectives: string[];
  budgetEnvelope?: { currency: string; amount: number; hours: number };
  campaigns: GtmCampaign[];
  calendar: { week: number; playIds: string[] }[];
  evidenceGraphId: string;
  brandGraphVersion: string;
  labels: string[];        // e.g. "directional", "insufficient-evidence"
  createdAt: string;
}

interface GtmCampaign {
  id: string;
  theme: string;
  channels: Channel[];
  segment?: string;
  expectedImpactBand: string;
  confidence: "Low" | "Medium" | "High";
  dependsOn: string[];     // campaign/play ids
  plays: GtmPlay[];
  measurement: MeasurementContract;
  evidenceIds: string[];
}

interface GtmPlay {
  id: string;
  channel: Channel;
  title: string;
  effortHours: number;
  week: number;
  assets: GtmAsset[];
  evidenceIds: string[];
  tasks: { id: string; title: string; ownerRole: string }[];
}

interface MeasurementContract {
  baseline: string;
  leadingIndicators: string[];
  comparisonWindowDays: number;
  attributionCaveat: string;
}
```

## 6. Orchestration algorithms

1. **Build evidence graph** from `AnalyzeResult` (+ optional OrgBrief).  
2. **Upsert Brand KG** — merge crawl/GEO-inferred facts with human org brief; never invent proof; mark assumptions.  
3. **Propose campaigns** from playbook registry filtered by evidence gaps (SEO blockers, GEO misses, citation targets, content gaps, paid/ABM/PR seeds).  
4. **DAG** — e.g. technical fix → service page → FAQ → nurture → outreach → paid amplification. Topological order; reject cycles.  
5. **Calendar** — pack plays into weeks under capacity (`hoursPerWeek`).  
6. **Budget** — allocate hours/money by priority weights; sum must equal envelope.  
7. **Claim gate** — every asset body must either avoid blocked patterns or cite evidence; blocking flags prevent `approved`.  
8. **Snapshot** — store immutable JSON + HTML board-ready program summary.

## 7. MadTech seams (stub adapters)

| Seam | Purpose | Day-1 behavior |
|---|---|---|
| `ProfileEventSeam` | Segment/audience activation | Export JSON segment definition |
| `PaidBriefSeam` | Google/Meta/LinkedIn | Produce paid brief + audience + creative variants |
| `CrmExportSeam` | HubSpot/Salesforce | Export ABM list / tasks CSV+JSON |
| `DamSeam` | Approved assets | Reference BKG proofAssets |
| `ConsentSeam` | CMP gate | Flag plays that need consent before activation |
| `MeasurementSeam` | GA4/GSC/ads | Fill contracts; live pull when creds present |

## 8. Error handling & honesty rules

- Thin GEO sample → `directional` labels; never fake rankings.  
- Missing OrgBrief → enterprise defaults with `assumed` flags.  
- No Gemini key → deterministic strategist floor (must still pass claim gate).  
- Connectors without credentials → `not_configured` / stub, never silent fake metrics.  
- Hard rule: no unsupported `%` lifts, `#1`, named clients without proof assets.

## 9. Testing requirements

- Evidence graph: every node has `kind` + `sourceRef`.  
- Brand KG: services/audiences preserved when provided; not overwritten by junk title inference.  
- DAG: topo-order correct; cycle throws.  
- Budget: allocations sum to envelope (±0.1h).  
- Program E2E on demo analyze: ≥3 channels, sequenced weeks, every play has `evidenceIds`, claim-gate blocks invented metrics.  
- HTML snapshot contains evidence trail + campaign calendar.

## 10. Success criteria (when you say "this is good")

1. Position narrative reads like a strategist memo, not a bullet dump.  
2. GTM Program is coordinated across channels with dependencies and calendar — not duplicate isolated packs.  
3. Every material claim is evidence-cited or `[CONFIRM]`.  
4. Brand KG makes drafts sound on-voice for the org.  
5. Seams are clearly stubbed for MarTech/AdTech activation.

## 11. Build order after this spec

1. Implement keystone modules + wire into `/api/marketing/workspace` generate path.  
2. Channel playbooks (SEO/GEO/content first, then email/social/ABM/PR/paid).  
3. Agency runtime / operator queue (`2026-07-23-agentic-marketing-os-design.md`).  
4. Live connectors + learning loop.

## 12. Non-goals reminder

Do not claim "Phases 1–5 complete" until verified flows exist. Do not ship auto-publish. Do not invent AdTech ROAS without connectors.

---

**Next step for implementer:** invoke writing-plans against this spec, then execute Sub-project 1.
