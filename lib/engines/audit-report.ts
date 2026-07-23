/**
 * Dynamic audit document generation — premium HTML report (+ optional Playwright PDF).
 */

import type { EnrichedLead } from "@/lib/engines/sdr-lead-pipeline";
import { getObjectStore, type ObjectStore, type StoredObject } from "@/lib/storage/object-store";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Simple revenue-loss illustration from readiness gap (directional, labelled). */
export function estimateMonthlyRevenueAtRisk(lead: EnrichedLead): number {
  const score = lead.readinessScore ?? 50;
  const gap = Math.max(0, 85 - score);
  // Directional heuristic for outreach copy — not a forecast.
  return Math.round(gap * 120);
}

export function renderAuditReportHtml(input: {
  lead: EnrichedLead;
  generatedAt?: string;
  brand?: string;
}): string {
  const lead = input.lead;
  const at = input.generatedAt ?? new Date().toISOString();
  const brand = input.brand ?? "OpenGrowth";
  const risk = estimateMonthlyRevenueAtRisk(lead);
  const flags = lead.flags
    .map(
      (f) =>
        `<li><strong>${escapeHtml(f.code)}</strong> (${escapeHtml(f.severity)}): ${escapeHtml(f.detail)}</li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(brand)} Audit — ${escapeHtml(lead.nap.name)}</title>
  <style>
    :root { color-scheme: light; --ink:#111; --muted:#555; --line:#e5e5e5; --accent:#0f766e; }
    body { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif; margin: 0; color: var(--ink); background: #fafafa; }
    .sheet { max-width: 820px; margin: 0 auto; background: white; padding: 48px 56px; min-height: 100vh; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
    h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin: 32px 0 12px; }
    p, li { font-size: 15px; line-height: 1.55; color: var(--muted); }
    .hero { border-bottom: 1px solid var(--line); padding-bottom: 24px; margin-bottom: 8px; }
    .meta { font-size: 13px; color: var(--muted); }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 20px; }
    .stat { border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
    .stat strong { display: block; font-size: 28px; color: var(--ink); }
    .note { font-size: 12px; color: #888; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div class="meta">${escapeHtml(brand)} · Technical & local growth audit</div>
      <h1>${escapeHtml(lead.nap.name)}</h1>
      <p>${escapeHtml(lead.nap.address ?? "Address unavailable")} · ${escapeHtml(lead.nap.phone ?? "Phone unavailable")}</p>
      <p>Website: ${escapeHtml(lead.finalUrl ?? lead.website)}</p>
    </div>
    <div class="grid">
      <div class="stat"><span class="meta">Readiness</span><strong>${lead.readinessScore ?? "—"}</strong></div>
      <div class="stat"><span class="meta">Local schema</span><strong>${lead.hasLocalBusinessSchema ? "Yes" : "No"}</strong></div>
      <div class="stat"><span class="meta">Directional risk / mo</span><strong>$${risk.toLocaleString()}</strong></div>
    </div>
    <h2>Findings</h2>
    <ul>${flags || "<li>No material flags on this sample.</li>"}</ul>
    <h2>Niche context</h2>
    <p>${escapeHtml(lead.niche)} in ${escapeHtml(lead.geo)} · Source: ${escapeHtml(lead.source)} · Words: ${lead.wordCount ?? "n/a"}</p>
    <p class="note">Generated ${escapeHtml(at)}. Revenue risk is a directional outreach illustration from readiness gap — not a prediction. Source ${escapeHtml(lead.source)}.</p>
  </div>
</body>
</html>`;
}

export async function generateAuditReport(input: {
  lead: EnrichedLead;
  store?: ObjectStore;
  preferPdf?: boolean;
}): Promise<{ html: string; stored: StoredObject; format: "html" | "pdf" }> {
  const html = renderAuditReportHtml({ lead: input.lead });
  const store = input.store ?? getObjectStore();
  const preferPdf = input.preferPdf ?? process.env.OPENGROWTH_PDF === "playwright";

  if (preferPdf) {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      const stored = await store.put({ body: Buffer.from(pdf), contentType: "application/pdf" });
      return { html, stored, format: "pdf" };
    } catch {
      // Fall through to HTML artifact.
    }
  }

  const stored = await store.put({ body: html, contentType: "text/html; charset=utf-8" });
  return { html, stored, format: "html" };
}
