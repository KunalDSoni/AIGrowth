# Epic Reconciliation

| Previous Epic | Repository Status | Reusable Work | Missing Work | Priority Now | Decision |
|---|---|---|---|---:|---|
| Foundation | Mostly complete | Next.js App Router, TypeScript, Tailwind, Prisma schema, tests, build scripts | CI health check, production repository layer | P2 | Do not rebuild |
| Design system | Functional | Shared workspace shell, cards, buttons, metric summaries, loading states | Accessibility refinements and token cleanup | P2 | Defer unless blocking |
| Marketing landing page | Functional | `app/page.tsx`, `components/landing-preview.tsx` | Real media/visual asset polish | P2 | Preserve |
| Onboarding | Functional but incomplete | Progressive client flow, URL validation, localStorage project context | Server persistence, richer business graph | P0 | Extend later |
| Analysis screen | Functional demo | `app/analysis/page.tsx`, `components/analysis-progress.tsx` | Real job status and audit run persistence | P2 | Preserve for demo |
| Main dashboard | Functional but shallow engine | `components/dashboard.tsx`, recommendation cards | Evidence-linked rankings and priority explanations | P0 | Extend |
| Audit workspace | UI plus demo data | `app/demo/audit/page.tsx`, `auditIssues` | Real crawl observations, normalized evidence, issue provenance | P0 | Candidate slice after recommendation intelligence |
| AI fix generator | Functional mock | `components/generation-workspace.tsx`, `/api/generate`, `MockAITextProvider` | Evidence-grounded prompts, claim validation, versioning | P1 | Preserve and later connect to evidence |
| Content opportunity planner | Functional mock | `components/content-planner.tsx`, `rankOpportunities` | Evidence-backed gap detection and search data | P0 | Candidate next slice |
| Competitor comparison | UI plus simulated results | `app/demo/competitors/page.tsx`, mock competitor data | Provider evidence, freshness, citations | P0 | Defer until evidence model exists |
| Growth assistant | Mock only | Deterministic assistant UI in `components/growth-assistant.tsx` | Retrieval over audit evidence and recommendation context | P1 | Defer |
| Project settings | UI only | `components/settings-panel.tsx` | Server persistence, team permissions, integration secrets | P2 | Defer |
| Authentication and organizations | Schema only | Prisma `User`, `Organization`, `Membership` | Runtime auth, authorization checks | P2 | Defer for demo; required before multi-user |
| Database persistence | Schema only | Prisma models for core entities | Migrations, runtime repositories, seed script writes | P2 | Align schema only in this run |
| AI SEO intelligence engine | Mostly missing | Basic priority function and static recommendation data | Evidence provenance, score components, assumptions, measurement plans, cross-engine synthesis | P0 | Selected slice |
| AI visibility | Missing | None | Prompt families, observation runs, mentions, citations, variability | P0 | High-priority future slice |
| Outcome learning | Minimal | Completion stored in localStorage; simulated metrics | Baseline windows, comparison periods, attribution confidence | P0 | Future slice |
