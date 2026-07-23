import { describe, expect, it } from "vitest";
import { createRegistry, DEFAULT_PIPELINE } from "@/lib/agents/registry";
import type { Agent } from "@/lib/agents/agent";
import { emptyCost } from "@/lib/agents/types";

const stub: Agent = {
  name: "observer",
  costClass: "moderate",
  async shouldRun() {
    return { run: true, reason: "always" };
  },
  async execute() {
    return { status: "ok", proposals: [], cost: emptyCost(), notes: [] };
  },
};

describe("agent registry", () => {
  it("returns a registered agent by name", () => {
    const registry = createRegistry([stub]);
    expect(registry.get("observer")).toBe(stub);
  });

  it("throws a named error for an unregistered agent", () => {
    const registry = createRegistry([]);
    expect(() => registry.get("observer")).toThrow("No agent registered for: observer");
  });

  it("rejects duplicate registrations", () => {
    expect(() => createRegistry([stub, stub])).toThrow("Duplicate agent registration: observer");
  });

  it("declares the pipeline in dependency order", () => {
    expect(DEFAULT_PIPELINE).toEqual([
      "observer",
      "onboarding",
      "diagnosis",
      "strategist",
      "packager",
      "compliance",
      "reporter",
    ]);
  });
});
