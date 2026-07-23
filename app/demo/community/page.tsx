import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunityPage() {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader className="text-center">
        <CardTitle>Community playbooks</CardTitle>
        <CardDescription>Not available yet. No placeholder or demo playbooks are shown.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/demo/dashboard"><ArrowLeft className="size-4" /> Back to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
