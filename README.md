# OpenGrowth AI

OpenGrowth AI is a functional, demo-ready MVP for an AI-native SEO and marketing operator. It turns a website audit into five clear business actions, explains the reasoning, and generates execution-ready work.

The bundled Northstar Accounting project is fictional. Competitor results, search estimates, projections, analytics and AI output are clearly labeled simulated or mock.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. No login or database is required for demo mode. Use the prefilled onboarding form or open `/demo/dashboard` directly.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Playwright may require `npx playwright install chromium` once on a new machine.

## Optional PostgreSQL persistence

The interactive demo intentionally uses browser storage so it works immediately. The production-oriented Prisma schema is included as the persistence contract.

```bash
# Set DATABASE_URL in .env.local, then:
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

`prisma/seed.ts` points to the canonical normalized demo dataset in `lib/data/demo.ts`; a production repository adapter should upsert those records. Database-backed repositories and authentication are the next implementation phase, not silently simulated here.

## Project structure

- `app/`: routes and guarded API boundaries
- `components/`: design system and interactive product features
- `lib/data/`: deterministic Northstar demo
- `lib/domain/`: provider-neutral application types
- `lib/engines/`: scoring, grouping and ranking logic
- `lib/providers/`: replaceable audit, AI, keyword, competitor and analytics contracts
- `lib/security/`: public URL validation and crawler safeguards
- `prisma/`: PostgreSQL data model
- `tests/`: unit and critical-flow Playwright coverage
- `docs/`: product and engineering decisions

## Demo behavior

Completion and onboarding state persist in `localStorage`. Generation and assistant responses come from deterministic mock providers. Connected data sources are explicitly shown as not connected. Generated content always requires human review.
