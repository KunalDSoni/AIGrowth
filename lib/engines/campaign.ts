/**
 * Marketing Orchestration Engine (EPIC ORCH-001).
 *
 * Bundles approved recommendations into a coordinated campaign with tasks,
 * owners, approval gates, a UTM plan and a mock publish/export handoff. Nothing
 * leaves the system without passing its approval gate — orchestration never
 * auto-publishes.
 */

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";
export type GateState = "pending" | "approved" | "rejected";

export interface CampaignTask {
  id: string;
  title: string;
  owner: string;
  recommendationId: string;
  status: TaskStatus;
  assetType: string;
}

export interface ApprovalGate {
  id: string;
  label: string;
  state: GateState;
  reviewer?: string;
}

export interface UtmPlan {
  source: string;
  medium: string;
  campaign: string;
  buildUrl(baseUrl: string, content?: string): string;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  recommendationIds: string[];
  tasks: CampaignTask[];
  gates: ApprovalGate[];
  utm: UtmPlan;
  scheduledFor?: string;
}

export interface CampaignSeed {
  id: string;
  title: string;
  assetType: string;
  owner?: string;
}

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function makeUtm(campaignName: string): UtmPlan {
  const campaign = slug(campaignName);
  return {
    source: "opengrowth",
    medium: "organic",
    campaign,
    buildUrl(baseUrl: string, content?: string) {
      const url = new URL(baseUrl);
      url.searchParams.set("utm_source", "opengrowth");
      url.searchParams.set("utm_medium", "organic");
      url.searchParams.set("utm_campaign", campaign);
      if (content) url.searchParams.set("utm_content", slug(content));
      return url.toString();
    },
  };
}

export function buildCampaign(input: {
  name: string;
  objective: string;
  recommendations: CampaignSeed[];
  scheduledFor?: string;
}): Campaign {
  const id = `campaign-${slug(input.name)}`;
  const tasks: CampaignTask[] = input.recommendations.map((rec) => ({
    id: `task-${rec.id}`,
    title: rec.title,
    owner: rec.owner ?? "Unassigned",
    recommendationId: rec.id,
    status: "todo",
    assetType: rec.assetType,
  }));

  const gates: ApprovalGate[] = [
    { id: `${id}-gate-content`, label: "Content & claim review", state: "pending" },
    { id: `${id}-gate-publish`, label: "Publish approval", state: "pending" },
  ];

  return {
    id,
    name: input.name,
    objective: input.objective,
    recommendationIds: input.recommendations.map((r) => r.id),
    tasks,
    gates,
    utm: makeUtm(input.name),
    scheduledFor: input.scheduledFor,
  };
}

export function setTaskStatus(campaign: Campaign, taskId: string, status: TaskStatus): Campaign {
  return { ...campaign, tasks: campaign.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) };
}

export function decideGate(campaign: Campaign, gateId: string, state: GateState, reviewer?: string): Campaign {
  return { ...campaign, gates: campaign.gates.map((g) => (g.id === gateId ? { ...g, state, reviewer } : g)) };
}

export function allTasksDone(campaign: Campaign): boolean {
  return campaign.tasks.length > 0 && campaign.tasks.every((t) => t.status === "done");
}

export function canPublish(campaign: Campaign): boolean {
  return campaign.gates.every((g) => g.state === "approved") && allTasksDone(campaign);
}

export interface ExportHandoff {
  campaignId: string;
  status: "ready" | "blocked";
  reason?: string;
  assets: { taskId: string; title: string; assetType: string; trackedUrl: string }[];
}

/**
 * Produce a mock publish/export handoff. If gates are not fully approved or
 * work is incomplete, the handoff is blocked with a reason rather than shipping.
 */
export function exportCampaign(campaign: Campaign, baseUrl: string): ExportHandoff {
  if (!canPublish(campaign)) {
    return {
      campaignId: campaign.id,
      status: "blocked",
      reason: campaign.gates.some((g) => g.state !== "approved")
        ? "One or more approval gates are not approved."
        : "Not all campaign tasks are done.",
      assets: [],
    };
  }
  return {
    campaignId: campaign.id,
    status: "ready",
    assets: campaign.tasks.map((task) => ({
      taskId: task.id,
      title: task.title,
      assetType: task.assetType,
      trackedUrl: campaign.utm.buildUrl(baseUrl, task.title),
    })),
  };
}
