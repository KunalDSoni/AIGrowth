# Epic status — OpenGrowth AI Engine

Updated: 2026-07-23

## Live product loop (shipped)

| Cluster | Status | Live wiring |
|---|---|---|
| CRAWL | Shipped (thin) | Safe crawl, sitemap discovery, multi-page scan |
| TSEO | Shipped (thin) | Live page audit + robots/sitemap + AI access findings |
| BIZ | Shipped (thin) | Inferred graph, assumption confirm/reject, goal lock → re-rank |
| SEARCH | Shipped (honest proxy) | Crawl-derived demand opportunities (not GSC) |
| CONTENT | Shipped (thin) | Inventory from crawl; GSC metrics explicitly unavailable |
| AIV | Shipped (thin) | Live Gemini probes, variants, re-probe API, history deltas |
| CITE | Shipped (thin) | Citation normalize/classify/aggregate from GEO |
| COMP | Shipped (thin) | Citation competitors + gap detection |
| REC | Shipped (thin) | Unified next-actions bus + goal weighting |
| GEN | Shipped (thin) | Brief → draft → approve + metadata/repurpose packs |
| ORCH | Shipped (thin) | Campaign from next actions + approval gates (no auto-publish) |
| LEARN | Shipped (thin) | Analyze deltas across runs |

## Honesty rules

- No Northstar / demo business data in primary UX
- Search demand labeled crawl-derived until GSC connected
- GEO is directional sample, never a ranking
- Campaigns never auto-publish

## APIs

- `POST /api/analyze` — SEO + GEO + intelligence + next actions
- `POST /api/business` — profile / goals / confirmations / re-rank
- `POST /api/geo-reprobe` — refresh GEO (± prompt variants)
- `POST /api/brief`, `POST /api/draft` — execute path
- `POST /api/metadata` — metadata + social/email repurpose packs
