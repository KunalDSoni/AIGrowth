"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmptyLiveState({
  title,
  description = "Run a live analyze on the dashboard first. This page only shows real results from your site.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Search className="size-6" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild>
          <Link href="/demo/dashboard">Analyze a website</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
