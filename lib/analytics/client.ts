import type { AnalyticsEvent } from "@/lib/providers/contracts";

export function track(event: AnalyticsEvent, properties: Record<string, string | number | boolean> = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("opengrowth:analytics", { detail: { event, properties } }));
}
