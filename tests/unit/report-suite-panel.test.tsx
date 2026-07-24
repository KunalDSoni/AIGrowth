import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReportSuitePanel } from "@/components/reports/report-suite-panel";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ statuses: { seo: "ready", geo: "insufficient", marketing: "not_run" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

describe("ReportSuitePanel", () => {
  it("renders the four export actions and fetched statuses", async () => {
    render(<ReportSuitePanel domain="acme.com" />);
    expect(screen.getByRole("button", { name: /SEO Report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /GEO Report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Marketing Report/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Full Position Report/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/insufficient/i)).toBeTruthy());
  });
});
