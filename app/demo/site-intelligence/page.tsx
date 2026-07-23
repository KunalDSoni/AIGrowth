import { AlertTriangle, FileWarning, LayoutGrid, ShieldCheck } from "lucide-react";
import { aiAccessFindings, contentInventory, contentRefreshCandidates, siteInventory } from "@/lib/data/demo";

const severityColor: Record<string, string> = {
  critical: "#9f1239",
  warning: "#b45309",
  notice: "#475569",
};

const statusColor: Record<string, string> = {
  healthy: "#166534",
  thin: "#b45309",
  stale: "#9f1239",
  duplicate: "#7c3aed",
  underperforming: "#b45309",
};

export default function SiteIntelligencePage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Site intelligence</span>
          <h1 className="serif">Inventory, crawler access &amp; content health</h1>
          <p>How the site is structured, whether AI and search crawlers can reach it, and which pages need work.</p>
        </div>
        <span className="pill">Demo crawl · simulated</span>
      </div>

      <section className="surface citation-actions">
        <span className="eyebrow"><LayoutGrid size={14} /> Page inventory</span>
        <h2>Pages classified by purpose</h2>
        <div className="tag-row">
          {Object.entries(siteInventory.countsByPurpose)
            .filter(([, count]) => count > 0)
            .map(([purpose, count]) => <span key={purpose}>{purpose}: {count}</span>)}
        </div>
        <div className="citation-action-grid">
          {siteInventory.pages.map((page) => (
            <article key={page.url}>
              <span className="pill">{page.purpose}</span>
              <h3>{page.url}</h3>
              <p className="fine">Confidence {page.confidence}% · {page.signals.join(", ")}</p>
            </article>
          ))}
        </div>
        {siteInventory.coverageGaps.length > 0 && (
          <p className="muted"><b>Coverage gaps:</b> {siteInventory.coverageGaps.map((g) => g.service).join(", ")}</p>
        )}
      </section>

      <section className="surface citation-actions">
        <span className="eyebrow"><ShieldCheck size={14} /> AI &amp; search crawler access</span>
        <h2>Can crawlers reach the content?</h2>
        {aiAccessFindings.length === 0 ? (
          <p className="muted">No crawler-access issues detected in the simulated robots setup.</p>
        ) : (
          <div className="citation-action-grid">
            {aiAccessFindings.map((finding) => (
              <article key={finding.id}>
                <span className="pill" style={{ color: severityColor[finding.severity] }}>{finding.severity}</span>
                <h3>{finding.title}</h3>
                <p>{finding.detail}</p>
                <p className="fine"><AlertTriangle size={12} /> {finding.caveat}</p>
                <div className="tag-row">{finding.affectedAgents.slice(0, 4).map((a) => <span key={a}>{a}</span>)}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface citation-actions">
        <span className="eyebrow"><FileWarning size={14} /> Content health &amp; refresh</span>
        <h2>Which pages need attention</h2>
        <div className="citation-action-grid">
          {contentInventory.map((item) => (
            <article key={item.url}>
              <span className="pill" style={{ color: statusColor[item.status] }}>{item.status}</span>
              <h3>{item.url}</h3>
              <p className="fine">Target: {item.targetQuery} · SEO value {item.seoValue} · {item.performanceSource}</p>
            </article>
          ))}
        </div>
        {contentRefreshCandidates.length > 0 && (
          <>
            <h3>Prioritized refresh candidates</h3>
            {contentRefreshCandidates.map((candidate) => (
              <p className="fine" key={candidate.url}>
                <b>{candidate.url}</b> (priority {candidate.priority}): {candidate.reasons.join(" ")}
              </p>
            ))}
          </>
        )}
      </section>
    </>
  );
}
