"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SdrJob } from "@/lib/engines/sdr-lead-pipeline";

export default function SdrPage() {
  const [niche, setNiche] = useState("Dentist");
  const [geo, setGeo] = useState("Ahmedabad");
  const [job, setJob] = useState<SdrJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function poll(id: string) {
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`/api/sdr/jobs?id=${encodeURIComponent(id)}`);
      const data = (await res.json()) as SdrJob & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Poll failed");
      setJob(data);
      if (data.status === "completed" || data.status === "failed") return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Job timed out");
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sdr/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ niche, geo, limit: 3 }),
      });
      const data = (await res.json()) as SdrJob & { error?: string };
      if (!res.ok && res.status !== 202) throw new Error(data.error ?? "Start failed");
      setJob(data);
      await poll(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "SDR job failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Agentic SDR lead audits"
        description="Background niche prospecting with safe crawl enrichment and premium audit reports."
        action={job ? <Badge variant="secondary">{job.status}</Badge> : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run outbound audit job</CardTitle>
          <CardDescription>
            Demo prospect source is labelled simulated until Google Places is connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche" disabled={busy} />
          <Input value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="Geo" disabled={busy} />
          <Button onClick={start} disabled={busy || !niche.trim() || !geo.trim()}>
            {busy ? "Running…" : "Start job"}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {job?.leads && (
        <div className="grid gap-3">
          {job.simulated && <Badge variant="outline">Simulated prospect source</Badge>}
          {job.leads.map((lead) => (
            <Card key={`${lead.nap.name}-${lead.website}`}>
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">score {lead.readinessScore ?? "—"}</Badge>
                  {!lead.hasLocalBusinessSchema && <Badge variant="outline">no local schema</Badge>}
                </div>
                <CardTitle className="text-base">{lead.nap.name}</CardTitle>
                <CardDescription>
                  {lead.nap.address ?? "—"} · {lead.nap.phone ?? "—"} · {lead.website}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {lead.flags.map((f) => (
                    <li key={f.code}>
                      <span className="font-medium text-foreground">{f.code}</span>: {f.detail}
                    </li>
                  ))}
                </ul>
                {job.reports
                  ?.filter((r) => r.leadName === lead.nap.name)
                  .map((r) => (
                    <Button key={r.url} variant="outline" size="sm" asChild>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        Open {r.format.toUpperCase()} report
                      </a>
                    </Button>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
