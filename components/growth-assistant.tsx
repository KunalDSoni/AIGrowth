"use client";
import { useState } from "react";
import { ArrowUp, Bot, Sparkles, User } from "lucide-react";
import { track } from "@/lib/analytics/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Msg = { role: "ai" | "user"; text: string };
const suggestions = ["What should I fix first?", "Create a 30-day SEO plan", "What can I safely ignore?", "Which opportunity may generate leads?"];

function answer(q: string) {
  const lower = q.toLowerCase();
  if (lower.includes("30-day"))
    return "Week 1: rewrite the homepage preview and consultation CTAs. Week 2: publish the medical-clinic page. Week 3: add service-to-industry internal links and schema. Week 4: draft the clinic bookkeeping checklist and review early conversion signals. Keep page-speed work in monitoring unless real-user data shows a problem.";
  if (lower.includes("ignore"))
    return "For now, ignore the unverified backlink gap and minor hero-image warning. Neither is supported by connected provider data. Focus on the missing clinic page, clearer search preview and consultation CTAs first.";
  if (lower.includes("leads"))
    return "The medical-clinic bookkeeping page is the strongest lead opportunity. It matches a service Northstar already delivers, serves specific commercial intent and gives the site a credible destination for future clinic content.";
  return "Fix the homepage search preview first. It is a 20-minute, high-confidence change that clarifies the offer before a visitor reaches the site. Then update consultation CTAs and use that language in the medical-clinic page.";
}

export function GrowthAssistant() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "I've read Northstar's demo audit and priorities. Ask me what to do, what to ignore, or have me turn a recommendation into a plan." },
  ]);
  const [input, setInput] = useState("");
  const submit = (value = input) => {
    if (!value.trim()) return;
    setMessages((m) => [...m, { role: "user", text: value }, { role: "ai", text: answer(value) }]);
    setInput("");
    track("assistant_question_submitted", { mode: "mock" });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="space-y-1">
        <Badge variant="secondary"><Sparkles className="size-3.5" /> Project-aware · Mock AI</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Your growth assistant</h1>
        <p className="text-muted-foreground">Answers use Northstar&rsquo;s audit, goals and current priorities.</p>
      </div>

      <Card className="gap-4 p-4">
        {messages.map((message, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {message.role === "ai" ? <Bot className="size-4" /> : <User className="size-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">{message.role === "ai" ? "OpenGrowth" : "You"}</p>
              <p className="mt-1 text-sm">{message.text}</p>
              {message.role === "ai" && index > 0 && (
                <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Recommended next step</p>
                  <p className="text-muted-foreground">Open the related action, generate the work, review it, then mark it complete.</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </Card>

      {messages.length === 1 && (
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
          placeholder="Ask about your audit…"
          aria-label="Ask the growth assistant"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
        />
        <Button size="icon" onClick={() => submit()} aria-label="Send question"><ArrowUp className="size-4" /></Button>
      </Card>
      <p className="text-center text-xs text-muted-foreground">Demo responses are deterministic and may contain assumptions. Review before acting.</p>
    </div>
  );
}
