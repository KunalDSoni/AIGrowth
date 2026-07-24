import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FixShipControls } from "@/components/fix-ship-controls";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

function fix(): CitationFix {
  return {
    id: "fix-faq-block",
    fixTypeId: "faq-block",
    feature: "hasFaqStructure",
    title: "Add an FAQ block",
    whatToCreate: "Add a Q&A block.",
    whyItEarnsCitations: "FAQ maps to questions.",
    affectedPrompts: ["p1"],
    competitorShare: 0.5,
    effort: "low",
    expectedLiftBand: "moderate",
    priority: 2,
    confidence: "Medium",
    evidenceIds: [],
    assumptions: ["directional"],
  };
}

afterEach(() => vi.restoreAllMocks());

describe("FixShipControls", () => {
  it("disables the ship button until an approver is entered (human gate)", () => {
    render(<FixShipControls domain="acme.invalid" fix={fix()} />);
    const btn = screen.getByRole("button", { name: /approve & ship/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/approver name/i), { target: { value: "kunal" } });
    expect(btn.disabled).toBe(false);
  });

  it("ships on click and then offers to measure lift", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ intervention: { id: "intervention-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    render(<FixShipControls domain="acme.invalid" fix={fix()} />);
    fireEvent.change(screen.getByLabelText(/approver name/i), { target: { value: "kunal" } });
    fireEvent.click(screen.getByRole("button", { name: /approve & ship/i }));

    await waitFor(() => expect(screen.getByText(/shipped/i)).toBeDefined());
    expect(screen.getByRole("button", { name: /measure lift/i })).toBeDefined();
  });

  it("surfaces a server error without shipping", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Cannot approve: unresolved claims" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    render(<FixShipControls domain="acme.invalid" fix={fix()} />);
    fireEvent.change(screen.getByLabelText(/approver name/i), { target: { value: "kunal" } });
    fireEvent.click(screen.getByRole("button", { name: /approve & ship/i }));

    await waitFor(() => expect(screen.getByText(/unresolved claims/i)).toBeDefined());
    expect(screen.queryByText(/shipped/i)).toBeNull();
  });
});
