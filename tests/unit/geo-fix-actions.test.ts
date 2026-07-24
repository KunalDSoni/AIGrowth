import { afterEach, describe, expect, it, vi } from "vitest";
import { measureLift, shipFix } from "@/lib/client/geo-fix-actions";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

function fix(): CitationFix {
  return {
    id: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    title: "Add an FAQ block",
    whatToCreate: "Add a Q&A block.",
    whyItEarnsCitations: "FAQ maps to questions.",
    affectedPrompts: ["p1"],
    competitorShare: 0.5,
    effort: "low",
    expectedLiftBand: "moderate",
    priority: 2,
    confidence: "Medium",
    evidenceIds: [],
    assumptions: ["directional"],
  };
}

function stubFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

/** vi.fn with a zero-arg impl types calls as []; read the actual recorded args as unknown[]. */
function callArgs(spy: ReturnType<typeof stubFetch>, i: number): unknown[] {
  return spy.mock.calls[i] as unknown[];
}

afterEach(() => vi.restoreAllMocks());

describe("shipFix", () => {
  it("posts domain, fix and approver and returns the intervention", async () => {
    const spy = stubFetch(200, { intervention: { id: "intervention-1", fixId: "fix-faq-block" } });
    vi.stubGlobal("fetch", spy);
    const res = await shipFix("acme.invalid", fix(), "kunal");
    expect(res.intervention.id).toBe("intervention-1");
    const [url, init] = callArgs(spy, 0);
    expect(url).toBe("/api/geo-fixes/ship");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      domain: "acme.invalid",
      approvedBy: "kunal",
      fix: { id: "fix-faq-block" },
    });
  });

  it("rejects a blank approver before calling the network (client-side gate)", async () => {
    const spy = stubFetch(200, {});
    vi.stubGlobal("fetch", spy);
    await expect(shipFix("acme.invalid", fix(), "   ")).rejects.toThrow(/approver/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws the server error message on a non-ok response", async () => {
    vi.stubGlobal("fetch", stubFetch(400, { error: "Cannot approve: unresolved claims" }));
    await expect(shipFix("acme.invalid", fix(), "kunal")).rejects.toThrow(/unresolved claims/i);
  });
});

describe("measureLift", () => {
  it("posts the intervention id and returns the measured result", async () => {
    const spy = stubFetch(200, { measured: true, lift: { fixId: "fix-faq-block", label: "directional" } });
    vi.stubGlobal("fetch", spy);
    const res = await measureLift("acme.invalid", "intervention-1");
    expect(res.measured).toBe(true);
    expect(res.lift?.label).toBe("directional");
    expect(JSON.parse((callArgs(spy, 0)[1] as RequestInit).body as string)).toMatchObject({
      domain: "acme.invalid",
      interventionId: "intervention-1",
    });
  });

  it("surfaces measured:false honestly", async () => {
    vi.stubGlobal("fetch", stubFetch(200, { measured: false, note: "requires a live answer engine" }));
    const res = await measureLift("acme.invalid", "intervention-1");
    expect(res.measured).toBe(false);
    expect(res.note).toMatch(/answer engine/i);
  });
});
