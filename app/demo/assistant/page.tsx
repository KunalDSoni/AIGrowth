"use client";

import { useMemo, useState } from "react";
import { ArrowUp, Bot, Sparkles, User } from "lucide-react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

type Msg = { role: "ai" | "user"; text: string };

export default function AssistantPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const suggestions = useMemo(() => {
    if (!result) return [];
    return [
      "What should I fix first?",
      `How visible is ${result.project.brandGuess} in AI answers?`,
      "Summarize the SEO score",
    ];
  }, [result]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="Assistant needs a live project" description="Analyze your site first. The assistant only answers from your real crawl and GEO results." />;
  }

  const answer = (q: string) => {
    const lower = q.toLowerCase();
    const top = result.nextActions[0];
    if (lower.includes("ai") || lower.includes("visible") || lower.includes("geo") || lower.includes("gemini")) {
      return `${result.project.brandGuess} was mentioned in ${result.geo.brandMentionRate}% of ${result.geo.sampleSize} live Gemini probes. First-party citation share is ${result.geo.firstPartyCitationShare}%. This is a directional sample, not a ranking.`;
    }
    if (lower.includes("score") || lower.includes("seo") || lower.includes("readiness")) {
      return `Live readiness for ${result.project.domain} is ${result.seo.site.score}/100 (${result.seo.site.band}) across ${result.seo.site.pagesScanned} pages, with ${result.seo.site.critical} critical and ${result.seo.site.high} high issues.`;
    }
    if (top) {
      return `Highest priority action: ${top.title}. Recommended next step: ${top.action} (priority ${top.priorityScore}/100, source ${top.source}).`;
    }
    return `No prioritized actions in the latest run for ${result.project.domain}. Re-analyze after making changes.`;
  };

  const submit = (value = input) => {
    if (!value.trim()) return;
    if (!started) {
      setStarted(true);
      setMessages([
        { role: "ai", text: `Loaded live project ${result.project.brandGuess} (${result.project.domain}). Ask about SEO score, GEO visibility, or what to fix first.` },
        { role: "user", text: value },
        { role: "ai", text: answer(value) },
      ]);
    } else {
      setMessages((m) => [...m, { role: "user", text: value }, { role: "ai", text: answer(value) }]);
    }
    setInput("");
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="space-y-1">
        <Badge variant="secondary"><Sparkles className="size-3.5" /> Live project · {result.project.domain}</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Growth assistant</h1>
        <p className="text-muted-foreground">Answers use only your latest analyze results.</p>
      </div>

      <Card className="gap-4 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask a question or pick a suggestion below.</p>
        )}
        {messages.map((message, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {message.role === "ai" ? <Bot className="size-4" /> : <User className="size-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">{message.role === "ai" ? "OpenGrowth" : "You"}</p>
              <p className="mt-1 text-sm">{message.text}</p>
            </div>
          </div>
        ))}
      </Card>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button key={suggestion} variant="outline" size="sm" onClick={() => submit(suggestion)}>{suggestion}</Button>
          ))}
        </div>
      )}

      <Card className="flex-row items-end gap-2 p-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about your live audit…"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
        />
        <Button size="icon" onClick={() => submit()} aria-label="Send"><ArrowUp className="size-4" /></Button>
      </Card>
    </div>
  );
}
