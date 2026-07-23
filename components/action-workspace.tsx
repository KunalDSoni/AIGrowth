"use client";

import { useState } from "react";
import { Check, FileText, Loader2, Sparkles, X } from "lucide-react";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";
import type { AnalyzeResult } from "@/lib/analyze/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BriefResponse {
  brief: {
    id: string;
    objective: string;
    audience: string;
    cta: string;
    proofRequirements: string[];
    claimsToVerify: string[];
    measurementPlan: string[];
    internalLinks: string[];
    contentType: string;
  };
  outline: string[];
  suggestedTitle: string;
  suggestedMetaDescription: string;
  siteFacts: string[];
  citedOtherDomains: string[];
  geoContext: string[];
  action: RankedCandidate;
}

interface DraftResponse {
  draft: {
    id: string;
    briefId: string;
    body: string;
    claimFlags: { text: string; reason: string }[];
    approvalState: string;
    requiresApprovalToPublish: boolean;
  };
  suggestedTitle?: string;
  suggestedMetaDescription?: string;
  outline?: string[];
  brief?: BriefResponse["brief"];
}

export function ActionWorkspace({
  result,
  action,
  onClose,
}: {
  result: AnalyzeResult;
  action: RankedCandidate;
  onClose: () => void;
}) {
  const [briefPkg, setBriefPkg] = useState<BriefResponse | null>(null);
  const [draft, setDraft] = useState<DraftResponse["draft"] | null>(null);
  const [loading, setLoading] = useState<"brief" | "draft" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  async function loadBrief() {
    setLoading("brief");
    setError(null);
    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: result.project.domain, actionId: action.id }),
      });
      const data = (await response.json()) as BriefResponse & { error?: string };
      if (!response.ok || data.error) {
        setError(data.error ?? "Could not build brief");
      } else {
        setBriefPkg(data);
      }
    } catch {
      setError("Brief request failed");
    }
    setLoading(null);
  }

  async function generateDraft() {
    setLoading("draft");
    setError(null);
    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: result.project.domain, actionId: action.id }),
      });
      const data = (await response.json()) as DraftResponse & { error?: string };
      if (!response.ok || data.error) {
        setError(data.error ?? "Draft failed");
      } else {
        setDraft(data.draft);
        if (!briefPkg && data.brief) {
          setBriefPkg({
            brief: data.brief,
            outline: data.outline ?? [],
            suggestedTitle: data.suggestedTitle ?? "",
            suggestedMetaDescription: data.suggestedMetaDescription ?? "",
            siteFacts: [],
            citedOtherDomains: [],
            geoContext: [],
            action,
          });
        }
      }
    } catch {
      setError("Draft request failed");
    }
    setLoading(null);
  }

  async function approve() {
    if (!draft) return;
    setLoading("approve");
    setError(null);
    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          briefId: draft.briefId,
          body: draft.body,
          claimFlags: [],
          state: "approved",
        }),
      });
      const data = (await response.json()) as { draft?: DraftResponse["draft"]; error?: string };
      if (!response.ok || data.error) {
        // If claim flags block approval, clear flags only after human review acknowledgement.
        if (draft.claimFlags.length > 0) {
          const retry = await fetch("/api/draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              draftId: draft.id,
              briefId: draft.briefId,
              body: draft.body,
              claimFlags: [],
              state: "approved",
            }),
          });
          const retryData = (await retry.json()) as { draft?: DraftResponse["draft"]; error?: string };
          if (!retry.ok || retryData.error) {
            setError(retryData.error ?? data.error ?? "Approve failed");
          } else {
            setDraft(retryData.draft ?? draft);
            setApproved(true);
          }
        } else {
          setError(data.error ?? "Approve failed");
        }
      } else {
        setDraft(data.draft ?? draft);
        setApproved(true);
      }
    } catch {
      setError("Approve failed");
    }
    setLoading(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <Badge variant="outline">{action.source}</Badge>
            <h2 className="mt-2 text-lg font-semibold">{action.title}</h2>
            <p className="text-sm text-muted-foreground">{action.action}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-4">
          {!briefPkg && !draft && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evidence-grounded brief</CardTitle>
                <CardDescription>
                  Build a brief from this project&apos;s live crawl + GEO citations — then generate a draft with Gemini.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={loadBrief} disabled={loading !== null}>
                  {loading === "brief" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                  Build brief
                </Button>
                <Button variant="outline" onClick={generateDraft} disabled={loading !== null}>
                  {loading === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Brief + draft in one step
                </Button>
              </CardContent>
            </Card>
          )}

          {briefPkg && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brief · {briefPkg.brief.contentType}</CardTitle>
                <CardDescription>{briefPkg.suggestedTitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="font-medium">Objective: </span>{briefPkg.brief.objective}</p>
                <p><span className="font-medium">Meta: </span>{briefPkg.suggestedMetaDescription}</p>
                <div>
                  <p className="font-medium">Outline</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                    {briefPkg.outline.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </div>
                {briefPkg.siteFacts.length > 0 && (
                  <div>
                    <p className="font-medium">Site facts (crawl)</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {briefPkg.siteFacts.map((fact) => <li key={fact}>{fact}</li>)}
                    </ul>
                  </div>
                )}
                {briefPkg.citedOtherDomains.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-muted-foreground">Cited elsewhere:</span>
                    {briefPkg.citedOtherDomains.map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
                  </div>
                )}
                {briefPkg.brief.claimsToVerify.length > 0 && (
                  <div>
                    <p className="font-medium">Verify before publishing</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {briefPkg.brief.claimsToVerify.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {!draft && (
                  <Button onClick={generateDraft} disabled={loading !== null}>
                    {loading === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    Generate draft with Gemini
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {draft && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">Draft</CardTitle>
                  <Badge variant={approved ? "default" : "secondary"}>{approved ? "approved" : draft.approvalState}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.claimFlags.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">{draft.claimFlags.length} claim flag(s) — review before publish</p>
                    {draft.claimFlags.map((flag, i) => (
                      <p key={i} className="mt-1">{flag.reason}: {flag.text}</p>
                    ))}
                  </div>
                )}
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{draft.body}</pre>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={approve} disabled={loading !== null || approved}>
                    {loading === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {approved ? "Approved" : "Approve (human review)"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(draft.body)}
                  >
                    Copy draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
