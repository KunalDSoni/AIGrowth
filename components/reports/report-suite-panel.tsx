"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionId = "seo" | "geo" | "marketing" | "full";
type Status = "ready" | "not_run" | "insufficient";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "seo", label: "SEO Report" },
  { id: "geo", label: "GEO Report" },
  { id: "marketing", label: "Marketing Report" },
  { id: "full", label: "Full Position Report" },
];

export function ReportSuitePanel({ domain }: { domain: string }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<SectionId | null>(null);

  useEffect(() => {
    if (!domain) return;
    void fetch(`/api/reports/generate?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.statuses) setStatuses(d.statuses);
      });
  }, [domain]);

  async function generate(section: SectionId) {
    setBusy(section);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, section }),
      });
      const data = await res.json();
      if (data?.url) window.open(data.url, "_blank", "noopener");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report suite</CardTitle>
        <CardDescription>Export any section on its own, or the full combined report.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((s) => {
          const status = s.id === "full" ? undefined : statuses[s.id];
          return (
            <div key={s.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                {status ? <Badge variant="outline">{status}</Badge> : null}
              </div>
              <Button size="sm" disabled={busy !== null} onClick={() => generate(s.id)}>
                {busy === s.id ? "Generating…" : `Download ${s.label}`}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
