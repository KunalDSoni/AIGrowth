// The complete deterministic demo dataset lives in lib/data/demo.ts so the app
// runs without infrastructure. Production seeding should upsert the same
// normalized records through a repository after `prisma migrate dev`.
console.info("Northstar demo data is bundled in lib/data/demo.ts. See README for database setup.");
