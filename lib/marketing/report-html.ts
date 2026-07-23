import type { CampaignPack, PositionReport } from "@/lib/marketing/types";
import { percentValue } from "@/lib/metrics/construct";
import { formatMetric } from "@/lib/metrics/format";

function esc(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Premium printable Position Report HTML with evidence + pack bodies. */
export function renderPositionReportHtml(
  report: PositionReport,
  packs: CampaignPack[],
  siteFacts: string[] = [],
): string {
  const steps = report.improvisation
    .map(
      (s) =>
        `<div class="step"><span class="tag">${esc(s.bucket)}</span><strong>${esc(s.title)}</strong><p>${esc(s.detail)}</p><p class="muted">${s.effortHours}h${s.packType ? ` · pack ${esc(s.packType)}` : ""}</p></div>`,
    )
    .join("");
  const chapters = report.chapters
    .map(
      (c) =>
        `<section><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p><ul>${c.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>`,
    )
    .join("");

  const facts =
    siteFacts.length > 0
      ? `<h2>Evidence trail (site facts)</h2><ul class="facts">${siteFacts
          .slice(0, 24)
          .map((f) => `<li>${esc(f)}</li>`)
          .join("")}</ul>`
      : "";

  const packBlocks = packs
    .map((p) => {
      const assets = p.assets
        .map(
          (a) =>
            `<div class="asset"><h4>${esc(a.kind)} · ${esc(a.title)}</h4><pre>${esc(a.body)}</pre>${
              a.claimChecks.length
                ? `<p class="flags">Claims: ${a.claimChecks.map(esc).join(" · ")}</p>`
                : ""
            }</div>`,
        )
        .join("");
      return `<section class="pack"><h3>${esc(p.packType)} — ${esc(p.goal)}</h3>
        <p class="muted">${esc(p.measurementPlan)} · ${p.effortHours}h · ${esc(p.generation ?? "deterministic")}</p>
        ${assets}</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Position Report — ${esc(report.brand)}</title>
  <style>
    :root { --ink:#0a0a0a; --muted:#525252; --line:#e5e5e5; --accent:#0f766e; --bg:#fafafa; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Iowan Old Style", Palatino, "Palatino Linotype", serif; color:var(--ink); background:var(--bg); }
    .sheet { max-width: 920px; margin: 0 auto; background:#fff; padding: 48px 56px; min-height: 100vh; }
    .eyebrow { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
    h1 { font-size: 34px; letter-spacing: -0.03em; margin: 8px 0 4px; }
    h2 { font-size: 14px; font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); margin: 32px 0 12px; }
    h3 { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 16px; margin: 28px 0 8px; }
    h4 { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; margin: 0 0 6px; }
    p, li { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.55; color: var(--muted); }
    .grid { display:grid; grid-template-columns: repeat(4,1fr); gap:12px; margin: 24px 0; }
    .stat { border:1px solid var(--line); border-radius: 12px; padding: 14px; }
    .stat strong { display:block; font-size: 28px; color:var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
    .stat span { font-size: 12px; color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; }
    .step, .pack, .asset { border:1px solid var(--line); border-radius: 12px; padding: 14px; margin: 10px 0; }
    .tag { display:inline-block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; border:1px solid var(--line); border-radius: 999px; padding: 2px 8px; margin-right: 8px; text-transform: uppercase; }
    .muted { color:#888; font-size: 12px; }
    .facts li { font-size: 12px; }
    pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.45; color: var(--ink); background: #f8f8f8; padding: 10px; border-radius: 8px; max-height: 420px; overflow: auto; }
    .flags { font-size: 11px; color: #b45309; margin-top: 8px; }
    @media print { body { background:#fff; } .sheet { padding: 0; } pre { max-height: none; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="eyebrow">OpenGrowth · SEO + GEO Position Report</div>
    <h1>${esc(report.brand)}</h1>
    <p>${esc(report.domain)} · Generated ${esc(report.generatedAt.slice(0, 19).replace("T", " "))} UTC · Mode: ${esc(report.mode)}</p>
    <div class="grid">
      <div class="stat"><span>SEO readiness</span><strong>${report.scoreboard.seoReadiness}</strong></div>
      <div class="stat"><span>GEO mention</span><strong>${formatMetric(percentValue(report.scoreboard.geoMentionRate, { basis: "measured", evidenceIds: [] }))}</strong></div>
      <div class="stat"><span>GEO sample</span><strong>${report.scoreboard.geoSampleSize}</strong></div>
      <div class="stat"><span>Competition</span><strong>${esc(report.scoreboard.competitorPressure)}</strong></div>
    </div>
    ${chapters}
    ${facts}
    <h2>Improvisation plan</h2>
    ${steps}
    <h2>Campaign packs (full drafts)</h2>
    ${packBlocks}
    <p class="muted">Labels: ${report.scoreboard.labels.map(esc).join(" · ") || "none"}. GEO figures are sample-gated and directional — not rankings. Do not ship blocked claims.</p>
  </div>
</body>
</html>`;
}
