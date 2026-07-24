// tests/unit/causal-ledger.test.ts
import { describe, expect, it } from "vitest";
import { createInMemoryLedger } from "@/lib/causal/ledger";
import type { Intervention } from "@/lib/causal/types";

const sample: Intervention = {
  id: "iv1",
  channel: "google_ads",
  hypothesis: "PMax lifts signups",
  startedAt: "2026-02-01T00:00:00.000Z",
};

describe("createInMemoryLedger", () => {
  it("records and retrieves an intervention", () => {
    const ledger = createInMemoryLedger();
    ledger.record(sample);
    expect(ledger.get("iv1")).toEqual(sample);
    expect(ledger.list()).toHaveLength(1);
  });

  it("seeds from an initial array and overwrites by id", () => {
    const ledger = createInMemoryLedger([sample]);
    ledger.record({ ...sample, hypothesis: "updated" });
    expect(ledger.get("iv1")?.hypothesis).toBe("updated");
    expect(ledger.list()).toHaveLength(1);
  });
});
