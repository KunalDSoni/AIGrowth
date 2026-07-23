import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { canPublish, exportCampaign } from "@/lib/engines/campaign";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runOrchEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence, delta } = ctx;
  const campaign = intelligence.campaign;

  const channels = [
    { channel: "website", tasks: campaign?.tasks.filter((t) => t.assetType === "fix" || t.assetType === "content").length ?? 0 },
    { channel: "seo-content", tasks: campaign?.tasks.filter((t) => t.assetType === "content").length ?? 0 },
    { channel: "linkedin", tasks: 0, note: "Available after GEN repurpose approval" },
    { channel: "email", tasks: 0, note: "Available after GEN repurpose approval" },
    { channel: "gbp", tasks: 0, note: "Mock plan only" },
    { channel: "paid", tasks: 0, note: "Planning only — no spend integration" },
  ];

  const calendar = (campaign?.tasks ?? []).map((t, index) => ({
    dateOffsetDays: index * 3,
    taskId: t.id,
    title: t.title,
    status: t.status,
  }));

  const handoff = campaign ? exportCampaign(campaign, result.project.url) : null;
  const progress = campaign
    ? {
        tasksDone: campaign.tasks.filter((t) => t.status === "done").length,
        tasksTotal: campaign.tasks.length,
        gatesApproved: campaign.gates.filter((g) => g.state === "approved").length,
        gatesTotal: campaign.gates.length,
        canPublish: canPublish(campaign),
      }
    : null;

  return [
    done("ORCH-001", "Campaign model", { campaign }),
    done("ORCH-002", "Recommendation-to-campaign flow", {
      recommendationIds: campaign?.recommendationIds ?? [],
      api: "POST /api/campaign rebuild",
    }),
    done("ORCH-003", "Channel plan builder", { channels }),
    done("ORCH-004", "Task and owner workflow", { tasks: campaign?.tasks ?? [] }),
    done("ORCH-005", "Approval gate framework", { gates: campaign?.gates ?? [] }),
    done("ORCH-006", "UTM and tracking plan", {
      utm: campaign
        ? { source: campaign.utm.source, medium: campaign.utm.medium, campaign: campaign.utm.campaign }
        : null,
    }),
    done("ORCH-007", "Calendar view", { calendar }),
    done("ORCH-008", "Mock publishing handoff", { handoff }),
    done("ORCH-009", "Campaign progress UI model", { progress }),
    done("ORCH-010", "Campaign outcome links", {
      deltaSummary: delta?.summary ?? null,
      linkedActionIds: campaign?.recommendationIds ?? [],
    }),
  ];
}
