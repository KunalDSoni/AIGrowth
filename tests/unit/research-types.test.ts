// tests/unit/research-types.test.ts
import { describe, expect, it } from "vitest";
import { INTEGRITY_REFUSAL } from "@/lib/research/types";

describe("research types", () => {
  it("exposes an integrity refusal message", () => {
    expect(INTEGRITY_REFUSAL).toMatch(/insufficient|cannot|won't|refuse/i);
  });
});
