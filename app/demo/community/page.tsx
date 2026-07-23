import Link from "next/link";
import { ArrowLeft, BookOpen, Globe2, Puzzle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunityPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <BookOpen className="size-7" />
      </div>
      <Badge variant="secondary">Future · Community</Badge>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Growth knowledge should be shared.</h1>
        <p className="text-muted-foreground">
          Community Playbooks will let practitioners publish transparent, reusable strategies for industries, markets and business stages.
        </p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Card className="text-left">
          <CardHeader>
            <Globe2 className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Reusable playbooks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Local SEO, content launches and technical recovery — with assumptions visible.
          </CardContent>
        </Card>
        <Card className="text-left">
          <CardHeader>
            <Puzzle className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Provider-neutral templates</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Designed for future plugins, integrations and multilingual workflows.
          </CardContent>
        </Card>
      </div>
      <Button asChild variant="outline">
        <Link href="/demo/dashboard"><ArrowLeft className="size-4" /> Back to workspace</Link>
      </Button>
    </div>
  );
}
