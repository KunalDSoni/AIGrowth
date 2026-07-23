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
