"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";

async function loadOrHint(domain?: string) {
  if (!domain) return { ws: null as MarketingWorkspace | null, hint: "demo" };
  const res = await fetch(`/api/marketing/workspace?domain=${encodeURIComponent(domain)}`);
  if (res.status === 404) return { ws: null, hint: "missing" };
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Load failed");
  return { ws: data.workspace as MarketingWorkspace, hint: "ok" };
}

export default function MarketingPacksPage() {
  const { result, ready } = useLiveAnalyze();
  const [ws, setWs] = useState<MarketingWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        // Prefer live domain workspace; fall back to scanning is not available — user must generate.
        const domain = result?.project.domain;
        const { ws: loaded, hint: h } = await loadOrHint(domain);
        setHint(h);
        if (loaded) setWs(loaded);
        else if (!domain) {
          // try common demo domain
          const demo = await loadOrHint("northstar.example");
          setHint(demo.hint === "ok" ? "ok" : "missing");
          if (demo.ws) setWs(demo.ws);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
  }, [ready, result?.project.domain]);

  async function setStatus(packId: string, status: "draft" | "review" | "approved" | "shipped") {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pack_status", domain: ws.domain, packId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setWs(data.workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Campaign Packs"
        description="Approve packs one by one. Status is saved to disk and survives refresh."
        action={
          <Button asChild variant="outline">
            <Link href="/demo/marketing">Back to Marketing OS</Link>
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!ws && (
        <Card>
          <CardHeader>
            <CardTitle>No saved workspace</CardTitle>
            <CardDescription>
              {hint === "missing"
                ? "Generate a workspace from the Marketing OS page first."
                : "Open Marketing OS and click Generate."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/demo/marketing">Generate workspace</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ws && (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{ws.domain}</Badge>
            <Badge variant="secondary">
              {ws.packs.filter((p) => p.status === "approved" || p.status === "shipped").length} approved
            </Badge>
          </div>
          {ws.packs.map((pack) => (
            <Card key={pack.id}>
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge>{pack.packType}</Badge>
                  <Badge variant={pack.status === "approved" || pack.status === "shipped" ? "secondary" : "outline"}>
                    {pack.status}
                  </Badge>
                  <Badge variant="outline">{pack.effortHours}h</Badge>
                </div>
                <CardTitle className="text-base">{pack.goal}</CardTitle>
                <CardDescription>{pack.measurementPlan}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pack.assets.map((asset) => (
                  <div key={`${pack.id}-${asset.title}`} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">
                      {asset.kind}: {asset.title}
                    </p>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {asset.body}
                    </pre>
                    {asset.claimChecks.length > 0 && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                        Claim checks: {asset.claimChecks.join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(pack.id, "review")}>
                    Send to review
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => setStatus(pack.id, "approved")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(pack.id, "shipped")}>
                    Mark shipped
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
