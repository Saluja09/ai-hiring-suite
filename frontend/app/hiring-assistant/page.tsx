"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mic } from "lucide-react";
import { toast } from "sonner";

import { AgentBuilder, type AgentBuiltResult } from "@/components/agent-builder";
import { CandidateInput } from "@/components/candidate-input";
import { ResultsTable, type CallRow } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { TourButton } from "@/components/tour-button";
import { cn } from "@/lib/utils";
import { api, type CandidateInput as ApiCandidateInput } from "@/lib/api";

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

type StepId = 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Build agent" },
  { id: 2, label: "Add candidates" },
  { id: 3, label: "Live results" },
];

function Stepper({ current }: { current: StepId }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {STEPS.map((step, index) => {
        const state =
          step.id < current ? "done" : step.id === current ? "active" : "upcoming";
        return (
          <li key={step.id} className="flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                state === "active" &&
                  "border-primary bg-primary/10 text-primary",
                state === "done" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
                state === "upcoming" &&
                  "border-border bg-muted text-muted-foreground",
              )}
            >
              {state === "done" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    state === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-border text-muted-foreground",
                  )}
                >
                  {step.id}
                </span>
              )}
              {step.label}
            </div>
            {index < STEPS.length - 1 ? (
              <div className="h-px w-6 bg-border sm:w-10" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HiringAssistantPage() {
  const [agent, setAgent] = React.useState<AgentBuiltResult | null>(null);
  const [calls, setCalls] = React.useState<CallRow[] | null>(null);
  const [launching, setLaunching] = React.useState(false);

  const step: StepId = calls ? 3 : agent ? 2 : 1;

  const handleAgentBuilt = React.useCallback((result: AgentBuiltResult) => {
    setAgent(result);
  }, []);

  const handleLaunch = React.useCallback(
    async (candidates: ApiCandidateInput[]) => {
      if (!agent) {
        return;
      }
      setLaunching(true);
      try {
        const rows = await api.createCalls(agent.campaignId, candidates);
        const seeded: CallRow[] = rows.map((row, index) => ({
          id: row.id ?? `pending-${index}`,
          callee_name: row.callee_name ?? candidates[index]?.name ?? null,
          mobile_number: row.mobile_number,
          status: row.status ?? "SCHEDULED",
        }));
        setCalls(seeded);
        toast.success("Calls launched", {
          description: `${seeded.length} candidate${seeded.length === 1 ? "" : "s"} queued for calling.`,
        });
      } catch (error) {
        toast.error("Couldn't start calls", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setLaunching(false);
      }
    },
    [agent],
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent)_0%,transparent_70%)] opacity-60"
      />

      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="flex items-center gap-3">
          <TourButton page="hiring-assistant" />
          <Badge variant="outline" className="hidden sm:inline-flex">
            Built on Hunar
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-24">
        <section className="flex flex-col gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Mic className="size-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Hiring Assistant
          </h1>
          <p className="max-w-2xl text-muted-foreground text-pretty">
            Turn a job description into a voice screening agent, add candidates, and
            watch call results come in live — no dialer, no script writing.
          </p>
        </section>

        <Stepper current={step} />

        <div data-tour="agent-form">
          <AgentBuilder onAgentBuilt={handleAgentBuilt} />
        </div>

        {agent ? (
          <div data-tour="candidates">
            <CandidateInput onLaunch={handleLaunch} launching={launching} />
          </div>
        ) : null}

        {agent && calls ? (
          <div data-tour="results">
            <ResultsTable
              campaignId={agent.campaignId}
              resultSchema={agent.resultSchema}
              initialCalls={calls}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
