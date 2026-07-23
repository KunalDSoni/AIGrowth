import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricStat } from "@/components/metrics/metric-stat";
import { MetricValue } from "@/components/metrics/metric-value";
import { geoMentionMetric } from "@/lib/marketing/metrics-view";

describe("MetricStat", () => {
  it("shows the value, confidence, and interval caption when reliable", () => {
    const metric = geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 });
    render(<MetricStat label="Answer-engine mention" metric={metric} />);
    expect(screen.getByText("40%")).toBeDefined();
    expect(screen.getByText(/confidence/i)).toBeDefined();
    expect(screen.getByText(/95% CI/i)).toBeDefined();
    expect(screen.getByText(/n=25/i)).toBeDefined();
  });

  it("gates below the minimum sample and shows no bare percentage", () => {
    const metric = geoMentionMetric({ brandMentionRate: 33, sampleSize: 3 });
    render(<MetricStat label="Answer-engine mention" metric={metric} />);
    expect(screen.getByText(/insufficient sample — n=3, need 20/i)).toBeDefined();
    expect(screen.queryByText("33%")).toBeNull();
  });

  it("renders the previous line when supplied", () => {
    const metric = geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 });
    render(<MetricStat label="X" metric={metric} previous="32% previous" />);
    expect(screen.getByText("32% previous")).toBeDefined();
  });
});

describe("MetricValue", () => {
  it("renders the value when reliable and the gate text when not", () => {
    const { rerender } = render(<MetricValue metric={geoMentionMetric({ brandMentionRate: 40, sampleSize: 25 })} />);
    expect(screen.getByText("40%")).toBeDefined();
    rerender(<MetricValue metric={geoMentionMetric({ brandMentionRate: 40, sampleSize: 2 })} />);
    expect(screen.getByText(/insufficient sample/i)).toBeDefined();
  });
});
