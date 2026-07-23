"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Arm = { id: string; label: string; alpha: number; beta: number };

type SelectPayload = {
  armId: string;
  label: string;
  payload: { headline?: string; cta?: string };
  sticky: boolean;
  visitorId: string;
  trafficShares: Record<string, number>;
  posteriorMeans: Record<string, number>;
  arms: Arm[];
  elapsedMs: number;
};

export default function BanditPage() {
  const [data, setData] = useState<SelectPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bandit/select");
      const json = (await res.json()) as SelectPayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Select failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Select failed");
    } finally {
      setBusy(false);
    }
  }

  async function convert(converted: boolean) {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bandit/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ armId: data.armId, converted }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Event failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Event failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageHeader
        title="Thompson Sampling CRO"
        description="Beta–Bernoulli bandit with sticky visitor bucketing. Converts update α; exits update β."
        action={
          data ? (
            <Badge variant="secondary">{data.elapsedMs.toFixed(2)} ms select</Badge>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardDescription>Assigned variation {data?.sticky ? "(sticky return visit)" : "(new draw)"}</CardDescription>
          <CardTitle className="text-2xl tracking-tight">{data?.payload.headline ?? "Loading…"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline">{data?.label ?? "—"}</Badge>
          <Button disabled={busy || !data} onClick={() => convert(true)}>
            Record conversion
          </Button>
          <Button disabled={busy || !data} variant="outline" onClick={() => convert(false)}>
            Record exit
          </Button>
          <Button disabled={busy} variant="secondary" onClick={load}>
            Re-select
          </Button>
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-3 md:grid-cols-3">
          {data.arms.map((arm) => (
            <Card key={arm.id}>
              <CardHeader>
                <CardTitle className="text-base">{arm.label}</CardTitle>
                <CardDescription>
                  α={arm.alpha} · β={arm.beta} · mean{" "}
                  {((data.posteriorMeans[arm.id] ?? 0) * 100).toFixed(1)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">
                  {((data.trafficShares[arm.id] ?? 0) * 100).toFixed(0)}%
                </div>
                <p className="text-sm text-muted-foreground">Observed traffic share</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
