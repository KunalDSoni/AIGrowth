import { describe, expect, it } from "vitest";
import {
  verifyFact,
  createRegistry,
  upsertFact,
  findFact,
  publiclyUsableFacts,
  isPubliclyUsable,
  GROUND_TRUTH_VERSION,
} from "@/lib/engines/legibility-ground-truth";

const base = {
  id: "f1",
  subject: "Acme",
  attribute: "category",
  value: "invoicing software",
  category: "category" as const,
  verifiedBy: "kunal@acme.com",
  sourceUrl: "https://acme.com/about",
};

describe("legibility ground truth registry", () => {
  it("exposes a version", () => {
    expect(GROUND_TRUTH_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("verifies a fact with a named verifier and provenance", () => {
    const f = verifyFact({ ...base, now: new Date("2026-07-24T00:00:00Z") });
    expect(f.value).toBe("invoicing software");
    expect(f.verifiedBy).toBe("kunal@acme.com");
    expect(f.verifiedAt).toBe("2026-07-24T00:00:00.000Z");
  });

  it("refuses a fact without a named verifier", () => {
    expect(() => verifyFact({ ...base, verifiedBy: "  " })).toThrow(/named verifier/i);
  });

  it("refuses a fact missing subject, attribute, or value", () => {
    expect(() => verifyFact({ ...base, value: "" })).toThrow(/subject, attribute, and value/i);
  });

  it("marks a sourced fact publicly usable and an unsourced fact not", () => {
    expect(isPubliclyUsable(verifyFact(base))).toBe(true);
    const unsourced = verifyFact({ ...base, sourceUrl: undefined, sourceNote: undefined });
    expect(isPubliclyUsable(unsourced)).toBe(false);
  });

  it("accepts a source note as provenance", () => {
    const f = verifyFact({ ...base, sourceUrl: undefined, sourceNote: "Confirmed by founder" });
    expect(isPubliclyUsable(f)).toBe(true);
  });

  it("upserts by attribute — latest verified value wins", () => {
    let reg = createRegistry("Acme");
    reg = upsertFact(reg, verifyFact({ ...base, value: "billing software" }));
    reg = upsertFact(reg, verifyFact({ ...base, id: "f2", value: "invoicing software" }));
    expect(reg.facts).toHaveLength(1);
    expect(findFact(reg, "category")?.value).toBe("invoicing software");
  });

  it("upsert is case-insensitive on the attribute key", () => {
    let reg = createRegistry("Acme");
    reg = upsertFact(reg, verifyFact({ ...base, attribute: "Category", value: "a" }));
    reg = upsertFact(reg, verifyFact({ ...base, id: "f2", attribute: "category", value: "b" }));
    expect(reg.facts).toHaveLength(1);
    expect(findFact(reg, "CATEGORY")?.value).toBe("b");
  });

  it("filters to publicly usable facts", () => {
    let reg = createRegistry("Acme");
    reg = upsertFact(reg, verifyFact(base));
    reg = upsertFact(
      reg,
      verifyFact({ ...base, id: "f2", attribute: "founded", value: "2020", sourceUrl: undefined, sourceNote: undefined }),
    );
    const usable = publiclyUsableFacts(reg);
    expect(usable.map((f) => f.attribute)).toEqual(["category"]);
  });

  it("upsert returns a new registry without mutating the original", () => {
    const reg = createRegistry("Acme");
    const next = upsertFact(reg, verifyFact(base));
    expect(reg.facts).toHaveLength(0);
    expect(next.facts).toHaveLength(1);
  });
});
