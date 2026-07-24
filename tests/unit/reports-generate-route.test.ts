import { describe, expect, it } from "vitest";
import { assembleSpineFrom } from "@/lib/reports/spine";
import { buildModelsForSection } from "@/app/api/reports/generate/route";

describe("buildModelsForSection", () => {
  const spine = assembleSpineFrom("acme.com", null, null);

  it("returns one model for a single section", () => {
    expect(buildModelsForSection(spine, "seo")).toHaveLength(1);
    expect(buildModelsForSection(spine, "seo")[0].slug).toBe("seo");
  });

  it("returns all three, in order, for the full bundle", () => {
    const models = buildModelsForSection(spine, "full");
    expect(models.map((m) => m.slug)).toEqual(["seo", "geo", "marketing"]);
  });

  it("throws on an unknown section", () => {
    // @ts-expect-error deliberate invalid section
    expect(() => buildModelsForSection(spine, "nope")).toThrow();
  });
});
