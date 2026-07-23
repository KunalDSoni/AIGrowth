import { describe, expect, it } from "vitest";
import { buildLiveRegistry, hashPages, LIVE_PIPELINE } from "@/lib/agents/wiring";

describe("agent wiring", () => {
  it("registers the observer agent", () => {
    expect(buildLiveRegistry().has("observer")).toBe(true);
  });

  it("exposes a pipeline containing only registered agents", () => {
    const registry = buildLiveRegistry();
    for (const name of LIVE_PIPELINE) {
      expect(registry.has(name)).toBe(true);
    }
  });

  it("hashes page identity stably regardless of order", () => {
    const a = hashPages([
      { url: "/", title: "Home" },
      { url: "/us/", title: "US" },
    ]);
    const b = hashPages([
      { url: "/us/", title: "US" },
      { url: "/", title: "Home" },
    ]);
    expect(a).toBe(b);
  });

  it("changes the hash when a title changes", () => {
    const a = hashPages([{ url: "/", title: "Home" }]);
    const b = hashPages([{ url: "/", title: "Home v2" }]);
    expect(a).not.toBe(b);
  });

  it("treats a null title as an empty string rather than throwing", () => {
    expect(() => hashPages([{ url: "/", title: null }])).not.toThrow();
    expect(hashPages([{ url: "/", title: null }])).toBe(hashPages([{ url: "/", title: "" }]));
  });
});
