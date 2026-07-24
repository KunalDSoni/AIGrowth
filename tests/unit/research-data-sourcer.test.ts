import { describe, expect, it } from "vitest";
import {
  sourceDatasets,
  isLicenseUsable,
  FIRST_PARTY_LICENSE,
  DATA_SOURCER_VERSION,
  type DatasetCandidate,
} from "@/lib/engines/research-data-sourcer";

const NOW = "2026-07-24T00:00:00.000Z";

const candidate = (over: Partial<DatasetCandidate> = {}): DatasetCandidate => ({
  id: "d1",
  title: "Freelance rate postings 2026",
  origin: "public",
  source: "data.gov",
  url: "https://data.gov/x",
  license: "cc-by-4.0",
  recordCount: 5000,
  retrievedAt: NOW,
  ...over,
});

describe("research data sourcer", () => {
  it("exposes a version", () => {
    expect(DATA_SOURCER_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("accepts an open-licensed public dataset with provenance", () => {
    const { accepted, rejected } = sourceDatasets([candidate()]);
    expect(rejected).toHaveLength(0);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].license).toBe("cc-by-4.0");
    expect(accepted[0].provenance).toMatch(/data\.gov/);
    expect(accepted[0].provenance).toMatch(/cc-by-4\.0/);
  });

  it("refuses an unlicensed public dataset", () => {
    const { accepted, rejected } = sourceDatasets([candidate({ license: undefined })]);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/unlicensed/i);
  });

  it("refuses a proprietary or all-rights-reserved public dataset", () => {
    const { rejected } = sourceDatasets([candidate({ license: "all-rights-reserved" })]);
    expect(rejected[0].reason).toMatch(/not an approved open licence/i);
  });

  it("refuses a non-commercial licence (unsafe for a commercial study)", () => {
    const { accepted, rejected } = sourceDatasets([candidate({ license: "cc-by-nc-4.0" })]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("accepts first-party data only when anonymised and aggregated", () => {
    const ok = sourceDatasets([
      candidate({
        id: "fp",
        origin: "first-party",
        source: "account CRM",
        license: undefined,
        anonymized: true,
        aggregated: true,
      }),
    ]);
    expect(ok.accepted).toHaveLength(1);
    expect(ok.accepted[0].license).toBe(FIRST_PARTY_LICENSE);
    expect(ok.accepted[0].provenance).toMatch(/anonymised and aggregated/i);
  });

  it("refuses first-party data that is not anonymised", () => {
    const { accepted, rejected } = sourceDatasets([
      candidate({ origin: "first-party", license: undefined, anonymized: false, aggregated: true }),
    ]);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/anonymised and aggregated/i);
  });

  it("refuses a dataset with no records", () => {
    const { rejected } = sourceDatasets([candidate({ recordCount: 0 })]);
    expect(rejected[0].reason).toMatch(/no records/i);
  });

  it("refuses a dataset with no retrieval provenance and no clock", () => {
    const { rejected } = sourceDatasets([candidate({ retrievedAt: undefined })]);
    expect(rejected[0].reason).toMatch(/provenance is missing/i);
  });

  it("stamps retrieval time from the clock when a candidate omits it", () => {
    const { accepted } = sourceDatasets([candidate({ retrievedAt: undefined })], { now: NOW });
    expect(accepted).toHaveLength(1);
    expect(accepted[0].retrievedAt).toBe(NOW);
  });

  it("exposes a usable-license predicate", () => {
    expect(isLicenseUsable("CC0")).toBe(true);
    expect(isLicenseUsable("cc-by-4.0")).toBe(true);
    expect(isLicenseUsable("proprietary")).toBe(false);
    expect(isLicenseUsable(undefined)).toBe(false);
  });

  it("partitions a mixed batch into accepted and rejected", () => {
    const { accepted, rejected } = sourceDatasets([
      candidate({ id: "ok", license: "cc0" }),
      candidate({ id: "bad", license: "unknown" }),
    ]);
    expect(accepted.map((a) => a.id)).toEqual(["ok"]);
    expect(rejected.map((r) => r.id)).toEqual(["bad"]);
  });
});
