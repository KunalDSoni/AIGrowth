import { cn } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function KpiStatCard({
  label,
  value,
  previous,
  deltaPct,
  hint,
  className,
}: {
  label: string;
  value: string;
  previous?: string;
  deltaPct?: number;
  hint?: string;
  className?: string;
}) {
  const positive = (deltaPct ?? 0) >= 0;
  return (
    <Card className={cn("gap-4 py-5", className)}>
      <CardHeader className="gap-3">
        <CardDescription>{label}</CardDescription>
        {previous ? <p className="text-xs text-muted-foreground">{previous} previous</p> : null}
        <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">{value}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {typeof deltaPct === "number" ? (
            <Badge variant={positive ? "secondary" : "outline"}>
              {positive ? "+" : ""}
              {deltaPct.toFixed(1)}%
            </Badge>
          ) : null}
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </div>
      </CardHeader>
    </Card>
  );
}
