# Epic status — OpenGrowth AI Engine

Updated: 2026-07-23

## V2 Industry-Grade Epics — COMPLETE

| Epic | Status | Proof |
|---|---|---|
| EVID-001 Unified Evidence Ledger | Done | Evidence kinds on analyze + `lib/engines/evidence.ts` |
| EVID-002 Evidence Drawer UI | Done | `components/evidence-drawer.tsx` on actions + rec detail |
| BIZ-001 Business Knowledge Graph | Done | `business-graph` + live intelligence |
| BIZ-002 Assumption Confirmation | Done | Confirm/reject via `/api/business` |
| CRAWL-001 Secure Crawl Core | Done | Safe crawler + SSRF guards |
| CRAWL-002 Site Inventory | Done | Purpose classification + coverage gaps |
| TSEO-001 Deterministic Audit Rules | Done | `live-audit` + site aggregate |
| TSEO-002 AI Bot Accessibility | Done | `ai-access` + audit/site UI |
| SEARCH-001 Demand Discovery | Done | Provider contract + crawl-derived signals |
| SEARCH-002 Intent / Clusters | Done | `search-intent` wired to opportunities |
| AIV-001 Prompt Families / Variants | Done | `prompt-variants` + re-probe |
| AIV-002 Observation Runner | Done | Gemini GEO + observation runs |
| AIV-003 Mention / Variability | Done | `geo-metrics` + AI visibility UI |
| CITE-001 Citation Intelligence | Done | Normalize/classify/aggregate |
| CITE-002 Citation Gap → Action | Done | `live-citation-gaps` (no Northstar) |
| CONTENT-001 GSC-Ready Inventory | Done | Inventory + honest GSC-unavailable labels |
| CONTENT-002 Quality / Refresh | Done | Refresh candidates → next actions |
| COMP-001 Competitor Types | Done | Types + user correction UI/API |
| COMP-002 Prompt/Citation Gaps | Done | Gaps → next actions |
| REC-001 Candidate Bus | Done | `recommendation-bus` |
| REC-002 Transparent Ranking | Done | Score detail page + explanations |
| GEN-001 Evidence Briefs | Done | `/api/brief` + action workspace |
| GEN-002 Claim-Safe Drafts | Done | Claim validation + asset versions + approve |
| ORCH-001 Campaign Workflow | Done | `/api/campaign` gates/tasks/export |
| LEARN-001 Outcomes / Attribution | Done | Analyze deltas + learning feedback into ranking |

## Honesty rules

- No Northstar / demo business data in primary UX
- Search demand labeled crawl-derived until GSC connected
- GEO is directional sample, never a ranking
- Campaigns never auto-publish
- Learning adjustments are directional multipliers only

## Primary APIs

- `POST /api/analyze` — SEO + GEO + intelligence + ranked next actions
- `POST /api/business` — profile / goals / confirmations / competitor corrections / re-rank
- `POST /api/geo-reprobe` — refresh GEO (± prompt variants)
- `POST /api/brief` · `POST /api/draft` · `POST /api/metadata`
- `POST /api/campaign` — rebuild / gates / tasks / export handoff
