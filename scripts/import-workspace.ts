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
