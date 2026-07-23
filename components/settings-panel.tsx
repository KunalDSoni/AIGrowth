"use client";
import { useState } from "react";
import { Check, Download, LockKeyhole, Plug, Trash2, Users } from "lucide-react";
import { track } from "@/lib/analytics/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const NAV = [
  ["business", "Business profile"],
  ["voice", "Brand voice"],
  ["market", "Target market"],
  ["integrations", "Data sources"],
  ["team", "Team members"],
  ["privacy", "Privacy & data"],
] as const;

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <Input defaultValue={defaultValue} />
    </label>
  );
}

export function SettingsPanel() {
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <PageHeader
        title="Northstar Accounting"
        description="Keep strategy, voice and connected data under your control."
        action={
          <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }}>
            <Check className="size-4" /> {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-sm">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          <Card id="business">
            <CardHeader>
              <CardTitle className="text-base">Business profile</CardTitle>
              <p className="text-sm text-muted-foreground">Used to keep recommendations commercially relevant.</p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" defaultValue="Northstar Accounting" />
              <Field label="Website" defaultValue="https://northstaraccounting.com.au" />
              <Field label="Industry" defaultValue="Accounting and bookkeeping" />
              <Field label="Main goal" defaultValue="Qualified consultation leads" />
            </CardContent>
          </Card>

          <Card id="voice">
            <CardHeader>
              <CardTitle className="text-base">Brand voice</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Preferred tone
                <textarea
                  className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  defaultValue="Professional, warm and plain-spoken. Confident without hype. Explain financial topics simply."
                />
              </label>
            </CardContent>
          </Card>

          <Card id="market">
            <CardHeader>
              <CardTitle className="text-base">Market and competitors</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary market" defaultValue="Australia" />
              <Field label="Competitors" defaultValue="LedgerWise, ClearBooks AU" />
            </CardContent>
          </Card>

          <Card id="integrations">
            <CardHeader>
              <CardTitle className="text-base">Connected data sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ["Google Search Console", "Search performance", "Not connected"],
                ["Google Analytics", "Conversion measurement", "Not connected"],
                ["WordPress", "Publishing", "Coming in beta"],
              ].map(([name, purpose, status]) => (
                <div key={name} className="flex items-center gap-3 rounded-lg border p-3">
                  <Plug className="size-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{purpose}</p>
                  </div>
                  <Badge variant="outline">{status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="team">
            <CardHeader>
              <CardTitle className="text-base">Team members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Users className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Team workspaces are coming in beta</p>
                  <p className="text-xs text-muted-foreground">The demo project is visible only in this browser.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="privacy">
            <CardHeader>
              <CardTitle className="text-base">Privacy and data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <LockKeyhole className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Demo data stays in this browser</p>
                  <p className="text-xs text-muted-foreground">Generated and completed states use local storage. No real website data is transmitted.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => track("export_clicked", { format: "json" })}>
                  <Download className="size-4" /> Export project JSON
                </Button>
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirm(true)}>
                  <Trash2 className="size-4" /> Delete project
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete this demo project?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This would clear browser-only completion and onboarding data. The seeded demo can be reopened at any time.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
              <Button onClick={() => { localStorage.clear(); setConfirm(false); }}>Delete demo data</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
