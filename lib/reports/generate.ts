import { renderReportHtml } from "@/lib/reports/render-html";
import type { ReportModel } from "@/lib/reports/types";
import { getObjectStore, type ObjectStore, type StoredObject } from "@/lib/storage/object-store";

export async function generateReportDocument(
  models: ReportModel | ReportModel[],
  opts: { store?: ObjectStore; preferPdf?: boolean } = {},
): Promise<{ url: string; format: "pdf" | "html"; stored: StoredObject }> {
  const html = renderReportHtml(models);
  const store = opts.store ?? getObjectStore();
  const preferPdf = opts.preferPdf ?? process.env.OPENGROWTH_PDF === "playwright";

  if (preferPdf) {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      const stored = await store.put({ body: Buffer.from(pdf), contentType: "application/pdf" });
      return { url: stored.url, format: "pdf", stored };
    } catch {
      // Fall through to HTML artifact.
    }
  }

  const stored = await store.put({ body: html, contentType: "text/html; charset=utf-8" });
  return { url: stored.url, format: "html", stored };
}
