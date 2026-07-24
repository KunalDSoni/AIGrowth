// tests/unit/windtunnel-runner.test.ts
import { describe, expect, it } from "vitest";
import { runWindTunnel } from "@/lib/windtunnel/runner";
import { createFakeResponder } from "@/tests/support/windtunnel-fixtures";
import type { Persona, Stimulus } from "@/lib/windtunnel/types";

const personas: Persona[] = [
  { id: "persona_smb", segment: "smb", jobsToBeDone: [], objections: [], vocabulary: ["fast", "simple"], quoteIds: ["e1"] },
];
const stimulus: Stimulus = {
  id: "s1",
  kind: "headline",
  variants: [
    { id: "v1", text: "Enterprise platform" },
    { id: "v2", text: "Fast simple setup" },
  ],
};

describe("runWindTunnel", () => {
  it("produces one reaction per persona with `samples` choices each", async () => {
    const reactions = await runWindTunnel({ personas, stimulus, responder: createFakeResponder(), samples: 4 });
    expect(reactions).toHaveLength(1);
    expect(reactions[0].personaId).toBe("persona_smb");
    expect(reactions[0].segment).toBe("smb");
    expect(reactions[0].choices).toHaveLength(4);
    expect(reactions[0].choices.every((c) => c.winnerVariantId === "v2")).toBe(true);
  });
});
