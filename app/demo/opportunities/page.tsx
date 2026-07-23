import { Target } from "lucide-react";
import { promptOpportunities } from "@/lib/data/demo";

const intentColor: Record<string, string> = {
  informational: "#475569",
  commercial: "#1d4ed8",
  comparison: "#7c3aed",
  transactional: "#166534",
  local: "#b45309",
  navigational: "#0f766e",
};

export default function OpportunitiesPage() {
  const top = promptOpportunities.slice(0, 16);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Search &amp; prompt demand</span>
          <h1 className="serif">Ranked growth opportunities</h1>
          <p>Prompt and topic opportunities scored by a demand proxy that blends estimated volume, competition and business relevance.</p>
        </div>
        <span className="pill">Demo provider · estimated</span>
      </div>
      <div className="context-note">
        <div>
          <b>Estimate guardrail</b>
          <p>Volume and competition are simulated estimates from the demo provider. Connect Search Console or a keyword provider to replace them with measured data.</p>
        </div>
      </div>
      <div className="ai-visibility-grid">
        {top.map((opportunity) => (
          <section className="surface ai-family" key={opportunity.id}>
            <div className="ai-family-head">
              <div>
                <span className="eyebrow">{opportunity.service}</span>
                <h2>{opportunity.query}</h2>
              </div>
              <span className="pill">Demand {opportunity.demandProxy}</span>
            </div>
            <div className="ai-metrics">
              <div><b>{opportunity.demandProxy}</b><span>Demand proxy</span></div>
              <div><b>{opportunity.businessRelevance}</b><span>Business relevance</span></div>
              <div><b style={{ color: intentColor[opportunity.intent] ?? "#334155", textTransform: "capitalize" }}>{opportunity.intent}</b><span>Intent</span></div>
            </div>
            <div className="tag-row">
              <span><Target size={12} /> {opportunity.funnelStage}</span>
              <span>{opportunity.topic}</span>
              {opportunity.labels.map((label) => <span key={label}>{label}</span>)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
