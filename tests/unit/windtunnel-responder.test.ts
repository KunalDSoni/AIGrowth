// tests/unit/windtunnel-responder.test.ts
import { describe, expect, it } from "vitest";
import { createFakeResponder } from "@/tests/support/windtunnel-fixtures";
import type { Persona, Stimulus } from "@/lib/windtunnel/types";

const persona: Persona = {
  id: "persona_smb",
  segment: "smb",
  jobsToBeDone: [],
  objections: ["setup too slow"],
  vocabulary: ["onboarding", "fast", "simple"],
  quoteIds: ["e1", "e2"],
};

const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "Enterprise-grade platform for teams" },
    { id: "v2", text: "Fast, simple onboarding in minutes" },
  ],
};

describe("createFakeResponder", () => {
  it("picks the variant that speaks the persona's vocabulary", async () => {
    const choice = await createFakeResponder().respond(persona, stimulus, 0);
    expect(choice.winnerVariantId).toBe("v2");
    expect(choice.reason).toMatch(/onboarding|fast|simple/i);
  });

  it("is deterministic across seeds", async () => {
    const r = createFakeResponder();
    const a = await r.respond(persona, stimulus, 1);
    const b = await r.respond(persona, stimulus, 99);
    expect(a.winnerVariantId).toBe(b.winnerVariantId);
  });
});
