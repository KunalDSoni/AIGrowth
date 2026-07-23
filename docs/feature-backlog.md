# OpenGrowth — Top AI Agentic Marketing OS  
## Master Feature Backlog (Review Before Build)

**Status:** PHASES 1–5 IMPLEMENTED (v1 Marketing OS) — deepen connectors next  
**Updated:** 2026-07-23  
**North star:** Diagnose SEO + GEO position → prescribe marketing tactics → package campaigns → agents draft with claim checks → humans approve → measure → learn  

> **Shipped UI:** `/demo/marketing` (shadcnblocks-admin KPI style) · Report · Packs · Outreach · Agency/Pods  
> **API:** `POST /api/marketing/os` · `POST /api/marketing/state`  

> **Promise:** The AI Marketing Operating System that lets a 2-person agency (or a founder) run diagnosis, strategy, campaign production, experimentation, and weekly reporting at the quality of a 12-person team — without fake rankings, without silent publish, without content spam.

---

# PART A — Strategy

## A1. What “Top AI Agentic Marketing OS” means

| Layer | What it does |
|---|---|
| **Sense** | Live SEO crawl + GEO probes + competitors + citations + business graph |
| **Judge** | Position Report + ranked Next Best Marketing Actions (evidence-gated) |
| **Package** | Campaign Packs (web/email/social/outreach/local/ads-lite) |
| **Act (agents)** | Multi-agent crew drafts, QA, schedules tasks — **never publishes alone** |
| **Learn** | Outcomes + bandit experiments reweight future tactics |

## A2. Agency disruption model

| Agency sells | Pain | OpenGrowth replaces |
|---|---|---|
| Audit PDF | Slow, generic | Instant SEO+GEO **Position Report** |
| Strategy deck | Vague | Ranked **tactic portfolio** + 30/60/90 plan |
| Creative production | Expensive | **Campaign Packs** in minutes |
| Monthly report | Vanity, late | **Weekly Growth Pack** with diffs |
| Junior research | Inconsistent | Always-on Scout/Analyst agents |

**GTM wedge:** *“Client-ready SEO+GEO Position Report + 30-day Marketing Campaign Pack in 15 minutes.”*

## A3. Build priority

1. **P0** Position Report + Improvisation steps  
2. **P0** Marketing tactic engine + Campaign Pack factory  
3. **P0** Agentic draft/QA/approval workflow  
4. **P1** Outreach CRM + Experiment Studio + Weekly Pack  
5. **P1** Multi-model GEO + white-label agency suite  
6. **P2** CMS ship-with-approval, GSC/GA4, multi-client pods  

## A3b. How many phases? → **5 phases**

| Phase | Name | Goal | Ships when |
|---:|---|---|---|
| **1** | **Position + Pack Core** | Client-ready SEO+GEO Position Report + improvisation + Campaign Pack factory (8 pack types) + Marketing OS Home + basic agent orchestration/approvals | Founder/agency can generate report → top tactics → approved packs |
| **2** | **Distribution + Experiments** | Citation Outreach CRM, SDR sequences (approve-to-send), Experiment Studio wired to packs, Weekly Growth Pack, outcome contracts | Agencies run outreach + CRO + weekly client reporting from the OS |
| **3** | **GEO Depth + Agency Suite** | Multi-model GEO, citation graph, why-not-cited, white-label polish, multi-client command center, proposals, client portal | Agencies resell diagnosis/reporting at scale |
| **4** | **Truth + Ship** | GSC/GA4 connectors, CMS draft push (WP/Shopify), local/GBP depth, remaining pack types, vertical templates | Plans use real demand/conversion; drafts land in CMS with approval |
| **5** | **Autonomous Marketing Pods** | Persistent per-client agent pods, war-room triggers, simulation, playbook outcome scores, budget governors, learning loop | Continuous agentic marketing under human approval — full Marketing OS |

**Total: 5 phases.** Implementation starts only after you approve Phase 1 (see Part I).

---

## A4. Non-negotiables

- No fake AI “rank #1” scores  
- No auto-publish to production  
- No unsupported claims in drafts  
- Weak evidence → say “insufficient / directional”  
- Estimates labelled as estimates  

---

# PART B — Flagship: SEO + GEO Position Report

## B1. Report chapters (required)

| # | Chapter | Contents |
|---|---|---|
| 1 | **Executive scoreboard** | SEO readiness, GEO mention/citation posture (n=, models, date), competitive pressure — honest labels |
| 2 | **Search position** | Intents you can win / missing / weak; page→intent map; technical blockers |
| 3 | **Answer-engine position** | Prompt families; who gets mentioned/cited; variance |
| 4 | **Trust & entity** | Proof, schema, NAP/entity consistency, review signals |
| 5 | **Impact** | Top gaps + directional lead/revenue risk (labelled) |
| 6 | **Improvisation plan** | **Fix → Publish → Promote → Measure** steps |
| 7 | **Marketing tactics this month** | Channel mix + linked Campaign Packs |
| 8 | **Appendix** | Evidence IDs, methodology, limitations |

## B2. Report product features

| ID | Feature | P |
|---|---|---|
| RPT-001 | Generate Position Report from latest analyze run | P0 |
| RPT-002 | Improvisation steps: Fix / Publish / Promote / Measure | P0 |
| RPT-003 | White-label HTML + PDF (logo, colors, hide OG chrome) | P0 |
| RPT-004 | Client mode vs Strategist mode | P0 |
| RPT-005 | One-click “Generate Campaign Packs for top 3 steps” | P0 |
| RPT-006 | Position diff vs previous run | P1 |
| RPT-007 | Share link (password, expiry) | P1 |
| RPT-008 | Multi-language narrative | P2 |
| RPT-009 | Vertical templates (dental, legal, clinic, SaaS, local services) | P1 |
| RPT-010 | Proposal appendix: 90-day retainer scope from report | P1 |
| RPT-011 | Print/PDF under 10s; store + public/auth URL | P0 |
| RPT-012 | “Explain like I’m the founder” audio/voice summary (optional) | P2 |

---

# PART C — Marketing tactics library (“gimmicks” that actually work)

> “Gimmick” here means **repeatable growth tactics**, not dark patterns. Each tactic must map to evidence + a Campaign Pack + a measure plan.

## C1. Demand capture (inbound)

| ID | Tactic | When to recommend | Campaign Pack |
|---|---|---|---|
| TAC-001 | Commercial service page for money intent | Intent with no page | PACK-SERVICE |
| TAC-002 | Comparison / vs page | GEO/search shows “X vs Y” | PACK-COMPARE |
| TAC-003 | Problem→solution pillar + cluster | Topical gap vs competitors | PACK-CLUSTER |
| TAC-004 | FAQ / People-Also-Ask capture | Questions in GEO answers | PACK-FAQ |
| TAC-005 | Pricing clarity page | High commercial intent, weak CTA | PACK-PRICING |
| TAC-006 | Use-case / industry landing pages | Vertical audiences in graph | PACK-VERTICAL |
| TAC-007 | Local service+geo pages (quality-gated) | Local business, multi-area | PACK-LOCAL |
| TAC-008 | Content refresh of decaying winners | Traffic/citation decay | PACK-REFRESH |
| TAC-009 | Internal link push to money pages | Orphan/high-value pages | PACK-INTERLINK |
| TAC-010 | Schema upgrade (LocalBusiness, FAQ, Service) | Missing entity clarity | PACK-SCHEMA |

## C2. GEO / answer-engine tactics

| ID | Tactic | When | Pack |
|---|---|---|---|
| TAC-020 | Citation magnet asset (original data, checklist, calculator) | Low citations | PACK-MAGNET |
| TAC-021 | Source-class outreach (directories, associations, niche blogs) | Citation gap by class | PACK-OUTREACH |
| TAC-022 | Entity cleanup sprint (About, NAP, sameAs, org schema) | Inconsistent brand entity | PACK-ENTITY |
| TAC-023 | Answer-shaped page sections (direct answer + proof) | Mentioned poorly / not cited | PACK-ANSWER |
| TAC-024 | llms.txt + AI-bot access hygiene | Blocked / unclear AI fetch | PACK-AIBOT |
| TAC-025 | Expert quote / byline E-E-A-T pack | YMYL / trust-sensitive | PACK-EEAT |
| TAC-026 | Multi-model prompt defense set | Losing on buyer prompts | PACK-GEODEF |

## C3. Conversion & CRO

| ID | Tactic | When | Pack |
|---|---|---|---|
| TAC-030 | Proof-led homepage rewrite | Weak proof/CTA | PACK-HOME |
| TAC-031 | Offer repositioning (OMF fit) | GEO asks ≠ site claims | PACK-OFFER |
| TAC-032 | Lead magnet + email capture | Top funnel demand | PACK-MAGNET-LEAD |
| TAC-033 | Booking / consult friction kill | High traffic, low convert | PACK-BOOKING |
| TAC-034 | Thompson bandit headline/CTA test | Enough traffic | PACK-EXPERIMENT |
| TAC-035 | Social proof wall / case study | Competitors show proof | PACK-CASE |
| TAC-036 | Objection FAQ near CTA | Sales objections known | PACK-OBJECTIONS |

## C4. Owned-channel marketing

| ID | Tactic | When | Pack |
|---|---|---|---|
| TAC-040 | Email nurture from service intent | Have list or growing list | PACK-EMAIL-NURTURE |
| TAC-041 | Reactivation / win-back sequence | Stale leads | PACK-WINBACK |
| TAC-042 | Newsletter “authority series” | GEO authority goal | PACK-NEWSLETTER |
| TAC-043 | LinkedIn founder POV series | B2B / professional services | PACK-LINKEDIN |
| TAC-044 | Short-form video script batch | Local / visual services | PACK-VIDEO |
| TAC-045 | WhatsApp / SMS booking reminders (opt-in) | Local appointment businesses | PACK-SMS |
| TAC-046 | Webinar / workshop funnel | High-consideration offers | PACK-WEBINAR |

## C5. Local / community / partnerships

| ID | Tactic | When | Pack |
|---|---|---|---|
| TAC-050 | GBP optimization + post cadence | Local | PACK-GBP |
| TAC-051 | Review acceleration + theme mining | Few/weak reviews | PACK-REVIEWS |
| TAC-052 | Partnership referral loops | Service adjacency | PACK-PARTNER |
| TAC-053 | Sponsorship / community mention | Local brand | PACK-COMMUNITY |
| TAC-054 | Chamber / association listing cleanup | Citation hygiene | PACK-LISTINGS |
| TAC-055 | PR-lite: data story pitch | Magnet asset ready | PACK-PRLITE |

## C6. Outbound / sales-assisted marketing

| ID | Tactic | When | Pack |
|---|---|---|---|
| TAC-060 | Personalized audit outreach (SDR) | Agency lead-gen or B2B | PACK-SDR |
| TAC-061 | Competitor customer conquest (ethical) | Clear competitor gaps | PACK-CONQUEST |
| TAC-062 | Warm intro scripts | Partner graph | PACK-INTRO |
| TAC-063 | Proposal follow-up sequences | High ticket | PACK-PROPOSAL-SEQ |

## C7. Paid (lite — optional, never core moat)

| ID | Tactic | When | Pack |
|---|---|---|---|
| TAC-070 | Search ads on top money intents only | Budget + clear landing | PACK-ADS-SEARCH |
| TAC-071 | Retargeting to proof/case pages | Pixel available | PACK-ADS-RETARGET |
| TAC-072 | Boost best organic/GEO angles | Validated message | PACK-ADS-BOOST |

## C8. Anti-patterns (explicitly blocked)

- Doorway spam local pages  
- Fake review schemes  
- Undisclosed AI content farms  
- Buying links / fake citations  
- Autodm spam / scraped email blasts without consent  
- Claiming guaranteed rankings or “#1 in ChatGPT”  

---

# PART D — Campaign Packs (exact asset inventory)

A **Campaign Pack** is a shippable folder of assets for one tactic, with claim checks + approval state.

## D1. Pack metadata (every pack)

| Field | Required |
|---|---|
| `packId`, `tacticId`, `goal`, `audience`, `offer` | Yes |
| `evidenceIds[]`, `assumptions[]`, `claimChecks[]` | Yes |
| `brandVoice`, `complianceFlags` | Yes |
| `status`: draft → review → approved → shipped | Yes |
| `measurementPlan` (baseline, window, signals) | Yes |
| `owner`, `dueDate`, `effortHours` | Yes |
| `channelMix` | Yes |

## D2. Pack types & required assets

### PACK-SERVICE — New/improved service page
- H1 + meta title/description  
- Page outline + full draft  
- Proof blocks + CTA variants (A/B for bandit)  
- FAQ (5) + FAQ schema JSON-LD  
- Internal link plan (from/to)  
- Social announce posts (3)  
- Email to list/segment (1)  
- Measure: rankings proxy / GSC / form fills  

### PACK-COMPARE — Vs / alternative page
- Comparison table structure  
- Fair claims rules (no defamation)  
- Draft + schema  
- Outreach to review sites (optional)  
- LinkedIn “how to choose” post set  

### PACK-CLUSTER — Pillar + supporting cluster
- Pillar brief + 3–7 supporting briefs  
- Interlink map  
- Promo calendar (2 weeks)  
- GEO prompt targets this cluster should win  

### PACK-FAQ — Question capture
- 8–15 Q&As grounded in GEO/search questions  
- On-page placement map  
- FAQ schema  
- Short social Q&A posts  

### PACK-PRICING — Pricing / packages clarity
- Package tiers copy  
- Objection handlers  
- CTA + consult framing  
- Email “how pricing works”  

### PACK-VERTICAL — Industry/use-case landing
- Vertical headline + pain narrative  
- Case/proof placeholders `[CONFIRM]`  
- CTA  
- Outreach list ideas for that vertical  

### PACK-LOCAL — Local landing (quality-gated)
- Unique local angles checklist (no doorway)  
- NAP consistency check  
- LocalBusiness schema  
- GBP post drafts (4)  
- Local citation targets  

### PACK-REFRESH — Content refresh
- Diff summary (what changed / why)  
- Updated draft sections  
- Re-promotion posts  
- Internal link updates  
- Recrawl + GEO re-probe checklist  

### PACK-INTERLINK — Internal links
- Priority link insertions (URL, anchor, reason)  
- CMS task list  
- Before/after crawl notes  

### PACK-SCHEMA — Structured data
- JSON-LD patches  
- Validation checklist  
- “What this helps” client language  

### PACK-MAGNET — Citation magnet asset
- Asset concept (checklist/calculator/data)  
- Landing page draft  
- Embeddable blurb for publishers  
- Outreach pitch email (3 variants)  
- Tracking UTM plan  

### PACK-OUTREACH — Citation / digital PR outreach
- Target list (domain, class, why)  
- Personalized pitch (per class)  
- Follow-up #1/#2  
- CRM statuses  
- Asset attach link  

### PACK-ENTITY — Entity consistency
- Mismatches table  
- About page rewrite  
- sameAs / org schema  
- Directory correction tasks  

### PACK-ANSWER — Answer-shaped content blocks
- Direct-answer paragraph  
- Supporting proof  
- Citations to first-party sources  
- Placement on existing URLs  

### PACK-AIBOT — AI crawler readiness
- robots / llms.txt recommendations  
- Bot access findings  
- Client explainer  

### PACK-EEAT — Trust / expertise
- Author bios  
- Editorial policy blurb  
- Quote/expert callout drafts  
- Credentials checklist  

### PACK-GEODEF — GEO defense set
- Priority prompt list  
- Page/section mapping per prompt  
- Competitor counter-angles  
- Re-probe schedule  

### PACK-HOME — Homepage conversion
- Hero variants (3) for bandit  
- Proof strip  
- CTA variants (3)  
- Above-fold wire copy  

### PACK-OFFER — Offer reposition
- Old vs new offer framing  
- Messaging house (pillars)  
- Site + email + sales one-pager  

### PACK-MAGNET-LEAD — Lead magnet funnel
- Magnet outline  
- Opt-in page  
- Thank-you + nurture email 1–3  
- Retargeting angles  

### PACK-BOOKING — Booking friction kill
- Form field reduction plan  
- Calendar CTA copy  
- Objection mini-FAQ  
- Confirmation message  

### PACK-EXPERIMENT — Bandit experiment
- Arm definitions (payloads)  
- Success event definition  
- Guardrails (min sample, stop rules)  
- Sticky bucketing notes  

### PACK-CASE — Case study
- Story structure (challenge/solution/result)  
- `[CONFIRM]` metrics placeholders  
- Site + PDF + social cuts  

### PACK-OBJECTIONS — Objection handling
- Top objections list  
- On-page + sales script answers  
- Email FAQ  

### PACK-EMAIL-NURTURE — Nurture sequence
- 5-email sequence  
- Segment rules  
- CTAs aligned to service pages  
- UTM + goals  

### PACK-WINBACK — Reactivation
- 3-email winback  
- Offer/ethical incentive options  
- Suppression rules  

### PACK-NEWSLETTER — Authority newsletter
- 4-week theme calendar  
- Issue 1 full draft  
- CTA to money pages  

### PACK-LINKEDIN — LinkedIn POV series
- 8 post drafts  
- Hook variants  
- CTA to report/page  
- Comment prompts  

### PACK-VIDEO — Short video batch
- 5 scripts (15–45s)  
- Hook + CTA  
- On-screen text cues  
- Publishing checklist  

### PACK-SMS — SMS/WhatsApp (opt-in only)
- Opt-in language  
- Reminder templates  
- Compliance notes  

### PACK-WEBINAR — Workshop funnel
- Title + abstract  
- Landing + email invites  
- Run-of-show  
- Replay CTA page outline  

### PACK-GBP — Google Business Profile
- Profile field checklist  
- 4 posts  
- Photo shot list  
- Q&A suggestions  

### PACK-REVIEWS — Reviews engine
- Ask-for-review scripts (email/SMS)  
- Theme mining → site proof bullets  
- Response templates  

### PACK-PARTNER — Referral partners
- Partner ICP list ideas  
- Mutual value prop  
- Intro email + co-marketing post  

### PACK-COMMUNITY — Community / sponsorship
- Opportunity brief  
- Talk track  
- Recap content plan  

### PACK-LISTINGS — Citations/listings cleanup
- NAP audit table  
- Priority directories  
- Correction copy  

### PACK-PRLITE — PR-lite pitch
- Story angle  
- Pitch email  
- Boilerplate  
- Asset kit links  

### PACK-SDR — Personalized audit outbound
- Target niche query  
- Audit highlights (from their site)  
- Email 1–3 + LinkedIn note  
- Booking link CTA  
- Compliance / personalization rules  

### PACK-CONQUEST — Competitor conquest (ethical)
- Competitor weakness evidence  
- Switcher landing outline  
- Ads/email angles (no trademark abuse policy)  

### PACK-INTRO — Warm intros
- Forwardable blurb  
- Ask script  

### PACK-PROPOSAL-SEQ — Proposal follow-up
- Follow-ups 1–4  
- Value bumps (report snippets)  
- Breakup email  

### PACK-ADS-SEARCH / RETARGET / BOOST
- Keyword/angle list from evidence  
- RSA-style headlines  
- Landing alignment checklist  
- Budget guardrails  
- **Labelled:** paid is optional accelerator, not core  

## D3. Campaign Pack product features

| ID | Feature | P |
|---|---|---|
| PKG-001 | Pack factory: action/tactic → pack type → assets | P0 |
| PKG-002 | Claim verification pass on all copy | P0 |
| PKG-003 | Brand voice enforcement | P0 |
| PKG-004 | Approval workflow (draft/review/approved/shipped) | P0 |
| PKG-005 | Export: Markdown / Doc / HTML / PDF zip | P0 |
| PKG-006 | “Send to Experiment Studio” for CTA/headline arms | P0 |
| PKG-007 | Pack versioning + diff | P1 |
| PKG-008 | Vertical pack templates library | P1 |
| PKG-009 | Multi-language pack generation | P2 |
| PKG-010 | CMS draft push (WP/Shopify) on approve | P2 |
| PKG-011 | Pack analytics: time-to-approve, reuse rate, outcome | P1 |

---

# PART E — Marketing OS tools (product modules)

## E1. Command center

| ID | Tool | Description | P |
|---|---|---|---|
| TOOL-001 | **Marketing OS Home** | Goal, capacity, this week’s packs, blockers | P0 |
| TOOL-002 | **Next Best Marketing Actions** | Ranked tactics from SEO+GEO evidence | P0 |
| TOOL-003 | **Channel mixer** | Effort allocation Site/Email/Social/Local/Outreach | P0 |
| TOOL-004 | **30/60/90 plan builder** | Calendar with owners & dependencies | P0 |
| TOOL-005 | **Capacity planner** | Hours/week → plan density | P0 |

## E2. Insight tools (feed marketing)

| ID | Tool | P |
|---|---|---|
| TOOL-010 | Live Analyze (SEO+GEO) | exists → deepen |
| TOOL-011 | Position Report studio | P0 |
| TOOL-012 | Intent→page→CTA mapper | P1 |
| TOOL-013 | GEO multi-model lab | P1 |
| TOOL-014 | Citation graph explorer | P1 |
| TOOL-015 | Competitor counter-position board | P1 |
| TOOL-016 | Content decay queue | P1 |
| TOOL-017 | Entity consistency checker | P1 |

## E3. Production tools

| ID | Tool | P |
|---|---|---|
| TOOL-020 | Campaign Pack studio | P0 |
| TOOL-021 | Asset editor + claim panel | P0 |
| TOOL-022 | Brand kit (voice, offers, CTAs, banned claims) | P0 |
| TOOL-023 | Template library (vertical + pack type) | P1 |
| TOOL-024 | Creative brief chat (grounded, not generic) | P1 |
| TOOL-025 | Translation / localization desk | P2 |

## E4. Distribution & CRM-lite

| ID | Tool | P |
|---|---|---|
| TOOL-030 | Citation Outreach CRM | P0 |
| TOOL-031 | SDR pipeline (prospect→report→sequence) | P1 |
| TOOL-032 | Partner / referral tracker | P2 |
| TOOL-033 | Review request tracker | P1 |
| TOOL-034 | Approve-to-send queue (email/LinkedIn copy only) | P1 |
| TOOL-035 | UTM & tracking plan generator | P0 |

## E5. Experimentation

| ID | Tool | P |
|---|---|---|
| TOOL-040 | Experiment Studio (Thompson bandit) | P0 |
| TOOL-041 | Arm library from packs | P0 |
| TOOL-042 | Success event definitions (click vs qualified lead) | P0 |
| TOOL-043 | Stop rules / sample size advisor | P1 |
| TOOL-044 | Cross-channel message learning | P2 |

## E6. Measurement & reporting

| ID | Tool | P |
|---|---|---|
| TOOL-050 | Weekly Growth Pack generator | P0 |
| TOOL-051 | Outcome contracts per action | P0 |
| TOOL-052 | Position movement dashboard | P1 |
| TOOL-053 | Tactic leaderboard (what worked) | P1 |
| TOOL-054 | Client portal (read-only) | P1 |
| TOOL-055 | GSC/GA4 connectors | P1 |
| TOOL-056 | Cost/token governor for GEO | P1 |

## E7. Agency suite

| ID | Tool | P |
|---|---|---|
| TOOL-060 | Multi-client command center | P1 |
| TOOL-061 | White-label theme | P0 |
| TOOL-062 | Proposal generator from report | P1 |
| TOOL-063 | Delivery checklist + effort estimates | P1 |
| TOOL-064 | Margin mode (cost vs retainer) | P2 |
| TOOL-065 | Team roles (strategist, copy, client) | P1 |
| TOOL-066 | Playbook library with outcome scores | P2 |

---

# PART F — Top AI Agentic architecture

## F1. Agent roster (required for “Marketing OS”)

| Agent | Mission | Inputs | Outputs | Human gate |
|---|---|---|---|---|
| **Scout** | Gather evidence | URL, niche | Crawl, GEO observations, competitor samples | Auto OK |
| **Analyst** | Diagnose position | Evidence | Position Report draft, gaps | Review report |
| **Strategist** | Choose tactics | Goals, capacity, gaps | Tactic portfolio, 30/60/90 | **Approve plan** |
| **Packager** | Build campaign packs | Approved tactics | Pack assets | **Approve packs** |
| **Copy Chief** | Voice + claim QA | Packs, brand kit | Annotated revisions | Review diffs |
| **Outreach Agent** | Personalize pitches | Citation/SDR targets | Sequences | **Approve send** |
| **Experimenter** | Run bandits | Approved arms | Traffic allocation, results | Approve launch/stop |
| **Reporter** | Narrative reporting | Diffs, outcomes | Weekly Growth Pack | Review/send |
| **Coach** | Founder explainability | Report | Plain-language Q&A | Optional |

## F2. Agentic OS features

| ID | Feature | P |
|---|---|---|
| AGT-001 | Shared tool bus (crawl, GEO, packs, bandit, store) | P0 |
| AGT-002 | Agent run log (what/why/evidence) | P0 |
| AGT-003 | Approval inbox (plan/pack/send/publish) | P0 |
| AGT-004 | Policy engine (banned claims, vertical rules) | P0 |
| AGT-005 | Multi-agent orchestration graph (DAG) | P0 |
| AGT-006 | Persistent **Client Marketing Pod** (scheduled loops) | P1 |
| AGT-007 | “War room” trigger (competitor move → counter-pack) | P1 |
| AGT-008 | Simulation mode (estimate impact bands before spend) | P2 |
| AGT-009 | Eval harness: “Would a senior strategist ship this?” | P0 |
| AGT-010 | Memory: client preferences, wins, failed tactics | P1 |
| AGT-011 | Escalation rules (low confidence → human) | P0 |
| AGT-012 | Budget governor (tokens, outreach volume, hours) | P1 |

## F3. Agentic operating loop (product UX)

```text
Schedule / On-demand
  → Scout refreshes evidence
  → Analyst updates Position
  → Strategist proposes tactic deltas
  → Human approves plan
  → Packager + Copy Chief produce packs
  → Human approves packs
  → Operator tasks + Experimenter (optional)
  → Reporter weekly pack
  → Learning updates tactic priors
```

---

# PART G — SEO / GEO features (supporting the OS)

## G1. SEO

| ID | Feature | P |
|---|---|---|
| SEO-201 | Intent→page→CTA map | P0 |
| SEO-202 | Business-weighted internal link planner | P1 |
| SEO-203 | Cannibalization resolver | P1 |
| SEO-204 | Content decay & refresh OS | P1 |
| SEO-205 | Local truth layer (no fake pack ranks) | P1 |
| SEO-206 | Programmatic quality gates (anti-doorway) | P0 |
| SEO-207 | Indexation / crawl triage | P2 |

## G2. GEO

| ID | Feature | P |
|---|---|---|
| GEO-101 | Multi-model triangulation | P1 |
| GEO-102 | Citation graph over time | P1 |
| GEO-103 | Why-not-cited root causes | P0 |
| GEO-104 | SoV by persona/funnel | P1 |
| GEO-105 | Answer→page gap briefs | P0 |
| GEO-106 | Brand entity auditor | P1 |
| GEO-107 | AI crawler readiness | P1 |

---

# PART H — Data, integrations, platform

| ID | Feature | P |
|---|---|---|
| PLT-001 | Project + multi-workspace | P0 |
| PLT-002 | Auth / roles | P1 |
| PLT-003 | GSC adapter | P1 |
| PLT-004 | GA4 adapter | P1 |
| PLT-005 | GBP API (where available) | P2 |
| PLT-006 | WordPress draft push | P2 |
| PLT-007 | Shopify draft push | P2 |
| PLT-008 | Slack/email notifications for approvals | P1 |
| PLT-009 | Object storage for reports/packs | P0 |
| PLT-010 | Redis/cache for bandit at scale | P2 |
| PLT-011 | Places API for SDR prospecting | P2 |
| PLT-012 | Webhooks out (pack approved, report ready) | P2 |

---

# PART I — Phase plan & Phase-1 build (after your approval)

## There are **5 phases** total

See **§A3b** for the full table. Summary:

1. **Phase 1 — Position + Pack Core**  
2. **Phase 2 — Distribution + Experiments**  
3. **Phase 3 — GEO Depth + Agency Suite**  
4. **Phase 4 — Truth + Ship**  
5. **Phase 5 — Autonomous Marketing Pods**  

### Phase 1 scope (propose — build next after approval)
1. **RPT-001..005, RPT-011** — Position Report + improvisation + white-label HTML + packs CTA  
2. **TOOL-001..005** — Marketing OS Home + NBMA + channel mixer + 30/60/90 + capacity  
3. **PKG-001..006** — Campaign Pack factory for first 8 pack types:  
   `SERVICE, FAQ, HOME, LOCAL, OUTREACH, SDR, EXPERIMENT, REFRESH`  
4. **TAC library wiring** — map SEO/GEO gaps → tactics → packs  
5. **AGT-001..005, AGT-009, AGT-011** — Scout/Analyst/Strategist/Packager/CopyChief orchestration + approvals + eval  
6. **TOOL-030, TOOL-040..042, TOOL-050..051** — Outreach CRM lite + Experiment Studio hooks + Weekly Growth Pack + outcome contracts  
7. Demo routes: `/demo/marketing`, `/demo/reports`, `/demo/packs`  

### Phase 2+ (not started until Phase 1 ships)
- **Phase 2:** full outreach/SDR send-queue, richer experiments, weekly pack polish  
- **Phase 3:** multi-model GEO farm, multi-client agency suite  
- **Phase 4:** GSC/GA4, CMS push, remaining packs/verticals  
- **Phase 5:** always-on Marketing Pods + simulation + learning marketplace  

---

# PART J — Review checklist (you)

Please mark:

- [ ] Strategy (agency-first Marketing OS) — **Approve / Change:** ___  
- [ ] Position Report chapters — **Approve / Change:** ___  
- [ ] Tactic library breadth — **Too much / OK / Add:** ___  
- [ ] Campaign Pack types list — **Cut these:** ___ / **Must-have first:** ___  
- [ ] Phase-1 build scope — **Approve / Narrow to:** ___  
- [ ] Vertical focus first — **Dental / Local services / B2B SaaS / Other:** ___  

**Reply with approvals or edits.** After you confirm, implementation starts from Phase 1 only.

---

# PART K — One-sentence future

OpenGrowth becomes the **control plane for growth**: agents continuously sense SEO+GEO reality, humans approve strategy, software manufactures campaign packs and experiments, and every week the system proves what moved — until mediocre agency production work is obsolete and great strategists are multiplied.
