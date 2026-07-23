"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ProjectAnalyze } from "./project-analyze";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">What should I do next?</h1>
          <p className="text-muted-foreground">
            Analyze a live website. Only real crawl and Gemini results appear here.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/demo/assistant">
            <Sparkles className="size-4" /> Growth assistant
          </Link>
        </Button>
      </div>

      <ProjectAnalyze />
    </>
  );
}
