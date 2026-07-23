import { describe, expect, it } from "vitest";
import {
  buildCampaign,
  canPublish,
  decideGate,
  exportCampaign,
  setTaskStatus,
  type Campaign,
} from "@/lib/engines/campaign";

function seedCampaign(): Campaign {
  return buildCampaign({
    name: "Clinic Growth Q3",
    objective: "Win clinic bookkeeping leads",
    recommendations: [
      { id: "medical-bookkeeping", title: "Create clinic page", assetType: "Landing page", owner: "Sam" },
      { id: "homepage-metadata", title: "Rewrite homepage preview", assetType: "SEO metadata" },
    ],
  });
}

describe("buildCampaign", () => {
  it("creates tasks per recommendation and two approval gates", () => {
    const c = seedCampaign();
    expect(c.tasks.length).toBe(2);
    expect(c.gates.length).toBe(2);
    expect(c.tasks[0].owner).toBe("Sam");
    expect(c.tasks[1].owner).toBe("Unassigned");
  });

  it("builds a UTM plan that produces tracked URLs", () => {
    const c = seedCampaign();
    const url = c.utm.buildUrl("https://example.com/page", "Create clinic page");
    expect(url).toContain("utm_campaign=clinic-growth-q3");
    expect(url).toContain("utm_source=opengrowth");
    expect(url).toContain("utm_content=create-clinic-page");
  });
});

describe("gates and publishing", () => {
  it("blocks export until every gate is approved and all tasks are done", () => {
    let c = seedCampaign();
    expect(canPublish(c)).toBe(false);
    const blocked = exportCampaign(c, "https://example.com");
    expect(blocked.status).toBe("blocked");

    c = setTaskStatus(c, "task-medical-bookkeeping", "done");
    c = setTaskStatus(c, "task-homepage-metadata", "done");
    c = decideGate(c, c.gates[0].id, "approved", "Reviewer");
    expect(canPublish(c)).toBe(false); // second gate still pending

    c = decideGate(c, c.gates[1].id, "approved", "Reviewer");
    expect(canPublish(c)).toBe(true);
  });

  it("produces tracked asset handoffs once ready", () => {
    let c = seedCampaign();
    c = setTaskStatus(c, "task-medical-bookkeeping", "done");
    c = setTaskStatus(c, "task-homepage-metadata", "done");
    c = decideGate(c, c.gates[0].id, "approved");
    c = decideGate(c, c.gates[1].id, "approved");
    const handoff = exportCampaign(c, "https://example.com");
    expect(handoff.status).toBe("ready");
    expect(handoff.assets.length).toBe(2);
    expect(handoff.assets[0].trackedUrl).toContain("utm_campaign=");
  });

  it("a rejected gate keeps the campaign unpublishable", () => {
    let c = seedCampaign();
    c = setTaskStatus(c, "task-medical-bookkeeping", "done");
    c = setTaskStatus(c, "task-homepage-metadata", "done");
    c = decideGate(c, c.gates[0].id, "approved");
    c = decideGate(c, c.gates[1].id, "rejected");
    expect(canPublish(c)).toBe(false);
  });
});
