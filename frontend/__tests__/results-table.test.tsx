// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultsTable } from "../components/results-table";

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
