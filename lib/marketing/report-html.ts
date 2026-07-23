import type { CampaignPack, PositionReport } from "@/lib/marketing/types";

function esc(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Premium printable Position Report HTML (client-ready). */
export function renderPositionReportHtml(report: PositionReport, packs: CampaignPack[]): string {
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
  const packList = packs
    .map((p) => `<li><strong>${esc(p.packType)}</strong> — ${esc(p.goal)} <em>(${esc(p.status)})</em></li>`)
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
    .sheet { max-width: 880px; margin: 0 auto; background:#fff; padding: 48px 56px; min-height: 100vh; }
    .eyebrow { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
    h1 { font-size: 34px; letter-spacing: -0.03em; margin: 8px 0 4px; }
    h2 { font-size: 14px; font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); margin: 32px 0 12px; }
    p, li { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.55; color: var(--muted); }
    .grid { display:grid; grid-template-columns: repeat(4,1fr); gap:12px; margin: 24px 0; }
    .stat { border:1px solid var(--line); border-radius: 12px; padding: 14px; }
    .stat strong { display:block; font-size: 28px; color:var(--ink); font-family: ui-sans-serif, system-ui, sans-serif; }
    .stat span { font-size: 12px; color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; }
    .step { border:1px solid var(--line); border-radius: 12px; padding: 14px; margin: 10px 0; }
    .tag { display:inline-block; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; border:1px solid var(--line); border-radius: 999px; padding: 2px 8px; margin-right: 8px; text-transform: uppercase; }
    .muted { color:#888; font-size: 12px; }
    @media print { body { background:#fff; } .sheet { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="eyebrow">OpenGrowth · SEO + GEO Position Report</div>
    <h1>${esc(report.brand)}</h1>
    <p>${esc(report.domain)} · Generated ${esc(report.generatedAt.slice(0, 19).replace("T", " "))} UTC · Mode: ${esc(report.mode)}</p>
    <div class="grid">
      <div class="stat"><span>SEO readiness</span><strong>${report.scoreboard.seoReadiness}</strong></div>
      <div class="stat"><span>GEO mention</span><strong>${(report.scoreboard.geoMentionRate * 100).toFixed(0)}%</strong></div>
      <div class="stat"><span>GEO sample</span><strong>${report.scoreboard.geoSampleSize}</strong></div>
      <div class="stat"><span>Competition</span><strong>${esc(report.scoreboard.competitorPressure)}</strong></div>
    </div>
    ${chapters}
    <h2>Improvisation plan</h2>
    ${steps}
    <h2>Campaign packs attached</h2>
    <ul>${packList}</ul>
    <p class="muted">Labels: ${report.scoreboard.labels.map(esc).join(" · ") || "none"}. GEO figures are sample-gated and directional — not rankings.</p>
  </div>
</body>
</html>`;
}
