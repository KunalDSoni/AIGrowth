import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "@/components/metrics/confidence-badge";

describe("ConfidenceBadge", () => {
  it("labels each confidence level", () => {
    const { rerender } = render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText(/high confidence/i)).toBeDefined();
    rerender(<ConfidenceBadge confidence="medium" />);
    expect(screen.getByText(/medium confidence/i)).toBeDefined();
    rerender(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText(/low confidence/i)).toBeDefined();
    rerender(<ConfidenceBadge confidence="insufficient" />);
    expect(screen.getByText(/insufficient sample/i)).toBeDefined();
  });

  it("renders nothing for an unsampled metric", () => {
    const { container } = render(<ConfidenceBadge confidence={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
