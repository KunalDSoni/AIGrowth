// tests/unit/windtunnel-types.test.ts
import { describe, expect, it } from "vitest";
import { SYNTHETIC_DISCLAIMER } from "@/lib/windtunnel/types";

describe("windtunnel types", () => {
  it("exposes a synthetic disclaimer string", () => {
    expect(SYNTHETIC_DISCLAIMER).toMatch(/synthetic/i);
    expect(SYNTHETIC_DISCLAIMER).toMatch(/hypothesis|not.*measurement/i);
  });
});
