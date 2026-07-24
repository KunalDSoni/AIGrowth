// tests/unit/research-sourcer.test.ts
import { describe, expect, it } from "vitest";
import { validateProvenance } from "@/lib/research/sourcer";
import { fixtureDataset } from "@/tests/support/research-fixtures";

describe("validateProvenance", () => {
  it("accepts a licensed dataset", () => {
    expect(validateProvenance(fixtureDataset()).ok).toBe(true);
  });

  it("rejects an unlicensed (unknown) dataset", () => {
    const bad = fixtureDataset({ provenance: { source: "scraped", license: "unknown", retrievedAt: "2026-01-01T00:00:00.000Z" } });
    const res = validateProvenance(bad);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/licens/i);
  });
});
