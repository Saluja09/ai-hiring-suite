// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResultsTable, type CallRow } from "../components/results-table";

// No global RTL cleanup is configured for this project's vitest setup, so
// each render leaks into jsdom across tests in this file unless we clean up
// explicitly.
afterEach(() => {
  cleanup();
});

describe("ResultsTable", () => {
  it("renders schema-driven columns, base call info, and result cells", () => {
    render(
      <ResultsTable
        campaignId={undefined}
        resultSchema={{ interested: "boolean", years_experience: "number" }}
        initialCalls={[
          {
            id: "c1",
            callee_name: "Asha",
            mobile_number: "+9199...",
            status: "COMPLETED",
            engagement_status: "ENGAGED",
            duration_seconds: 31,
            recording_url: null,
            result: { interested: true, years_experience: 3 },
          },
        ]}
      />,
    );

    // Schema-driven column headers (humanized).
    expect(
      screen.getByRole("columnheader", { name: "Interested" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Years Experience" }),
    ).toBeInTheDocument();

    // Candidate name renders.
    expect(screen.getByText("Asha")).toBeInTheDocument();

    // Status badge shows a humanized COMPLETED status.
    expect(screen.getByText("Completed")).toBeInTheDocument();

    // Boolean result cell shows the positive ("Yes") treatment.
    expect(screen.getByText("Yes")).toBeInTheDocument();

    // Number result cell shows the raw value.
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a muted dash for calls whose result is still empty", () => {
    render(
      <ResultsTable
        campaignId={undefined}
        resultSchema={{ interested: "boolean" }}
        initialCalls={[
          {
            id: "c2",
            callee_name: "Ravi",
            mobile_number: "+9198...",
            status: "SCHEDULED",
            engagement_status: null,
            duration_seconds: null,
            recording_url: null,
            result: {},
          },
        ]}
      />,
    );

    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();

    // Empty result schema column renders the muted em-dash.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("merges a new initialCalls reference by id instead of resetting state", () => {
    const rowA: CallRow = {
      id: "a1",
      callee_name: "Asha",
      mobile_number: "+9199...",
      status: "COMPLETED",
      engagement_status: "ENGAGED",
      duration_seconds: 31,
      recording_url: null,
      result: { interested: true },
    };

    const { rerender } = render(
      <ResultsTable
        campaignId={undefined}
        resultSchema={{ interested: "boolean" }}
        initialCalls={[rowA]}
      />,
    );

    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    // New array reference: staler version of rowA (status regressed) plus a new rowB.
    const staleRowA: CallRow = { ...rowA, status: "SCHEDULED" };
    const rowB: CallRow = {
      id: "b1",
      callee_name: "Ravi",
      mobile_number: "+9198...",
      status: "SCHEDULED",
      engagement_status: null,
      duration_seconds: null,
      recording_url: null,
      result: {},
    };

    rerender(
      <ResultsTable
        campaignId={undefined}
        resultSchema={{ interested: "boolean" }}
        initialCalls={[staleRowA, rowB]}
      />,
    );

    // rowB (new id) is added.
    expect(screen.getByText("Ravi")).toBeInTheDocument();

    // rowA is still present, exactly once, and keeps its existing (not staler) status.
    expect(screen.getAllByText("Asha")).toHaveLength(1);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders an empty state when there are no calls", () => {
    render(
      <ResultsTable
        campaignId={undefined}
        resultSchema={{ interested: "boolean" }}
        initialCalls={[]}
      />,
    );

    expect(screen.getByText("No calls yet")).toBeInTheDocument();
  });
});
