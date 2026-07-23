import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataRoot, dataDir } from "@/lib/storage/data-dir";
import { generateWorkspace } from "@/lib/marketing/workspace";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";
import { demoAnalyzeForMarketing } from "@/tests/fixtures/marketing";

const repoDataDir = join(process.cwd(), ".data");

describe("data directory isolation", () => {
  it("resolves the root from OPENGROWTH_DATA_DIR", () => {
    expect(process.env.OPENGROWTH_DATA_DIR).toBeTruthy();
    expect(dataRoot()).toBe(process.env.OPENGROWTH_DATA_DIR);
  });

  it("never resolves to the repository .data directory during tests", () => {
    expect(dataRoot().startsWith(repoDataDir)).toBe(false);
    expect(dataDir("marketing-workspaces").startsWith(repoDataDir)).toBe(false);
  });

  it("writes generated workspaces outside the repository", async () => {
    const fixture = demoAnalyzeForMarketing();
    fixture.intelligence = buildLiveIntelligence(fixture);
    const ws = await generateWorkspace({ analyze: fixture, hoursPerWeek: 8, useGemini: false });

    const written = join(dataDir("marketing-workspaces"), `${ws.domain}.json`);
    expect(existsSync(written)).toBe(true);
    expect(written.startsWith(repoDataDir)).toBe(false);

    // The fixture domain must not appear in the app's real data directory.
    expect(existsSync(join(repoDataDir, "marketing-workspaces", `${ws.domain}.json`))).toBe(false);
  });
});
