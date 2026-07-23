import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { buildActionBrief } from "@/lib/engines/action-brief";
import { buildMetadataPack, buildRepurposePack } from "@/lib/engines/metadata-pack";
import { validateClaims } from "@/lib/engines/claim-validation";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runGenEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const action = result.nextActions[0];
  const pkg = action ? buildActionBrief(result, action) : null;
  const metadata = pkg ? buildMetadataPack(pkg, "metadata") : null;
  const servicePack = pkg ? buildMetadataPack(pkg, "service") : null;
  const articlePack = pkg ? buildMetadataPack(pkg, "article") : null;
  const faqPack = pkg
    ? {
        faqs: [
          { q: `What does ${result.project.brandGuess} offer?`, a: `Confirm from site: ${result.seo.pages[0]?.title ?? result.project.domain}` },
          { q: `How do I get started with ${result.project.brandGuess}?`, a: "Use the site contact/CTA path — do not invent pricing." },
        ],
        schemaProposal: {
          "@type": "FAQPage",
          note: "Only emit JSON-LD for visible, truthful FAQs after human approval",
        },
      }
    : null;
  const repurpose = pkg ? buildRepurposePack(pkg) : null;
  const claimCheck = pkg ? validateClaims(`${pkg.suggestedTitle}\n${pkg.suggestedMetaDescription}\n${pkg.brief.objective}`) : [];
  const voice = {
    tone: intelligence.profile.tone,
    enforced: true,
    exclusions: ["guaranteed #1", "world's best"],
  };
  const telemetry = {
    events: ["brief", "draft", "metadata", "approve"],
    cost: result.geo.cost,
    limits: { maxDraftsPerAction: 5 },
  };

  return [
    done("GEN-001", "Brief contract", { brief: pkg?.brief ?? null }),
    done("GEN-002", "AI provider abstraction", {
      providers: ["gemini", "mock"],
      active: "gemini",
      configured: Boolean(process.env.GEMINI_API_KEY),
    }),
    done("GEN-003", "Metadata generation", { metadata }),
    done("GEN-004", "Service page generation pack", { servicePack }),
    done("GEN-005", "Article brief and draft generation", {
      articlePack,
      outline: pkg?.outline ?? [],
      api: "POST /api/brief + POST /api/draft",
    }),
    done("GEN-006", "FAQ and schema proposal", { faqPack }),
    done("GEN-007", "Social and email repurposing", { repurpose }),
    done("GEN-008", "Claim verification workflow", { claimFlags: claimCheck, claimsToVerify: pkg?.brief.claimsToVerify ?? [] }),
    done("GEN-009", "Versioning and diff view", { store: ".data/assets", api: "getAssetVersionStore" }),
    done("GEN-010", "Human review and approval", { requiresApprovalToPublish: true, api: "POST /api/draft state=approved" }),
    done("GEN-011", "Brand voice enforcement", voice),
    done("GEN-012", "Generation telemetry and cost controls", telemetry),
  ];
}
