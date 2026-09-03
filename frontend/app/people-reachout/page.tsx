"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, PhoneCall, Users } from "lucide-react";
import { toast } from "sonner";

import {
  CandidateSearch,
  type Candidate,
  type CandidateSearchOptions,
} from "@/components/candidate-search";
import { ResultsTable, type CallRow } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type CandidateInput } from "@/lib/api";
import { DEFAULT_RESULT_SCHEMA, buildAgentCreateRequest } from "@/lib/build-agent";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface CreatedAgent {
  campaignId: number;
  agentId: string;
  resultSchema: Record<string, string>;
}

export default function PeopleReachoutPage() {
  const [selected, setSelected] = React.useState<Candidate[]>([]);
  const [jdText, setJdText] = React.useState("");
  const [options, setOptions] = React.useState<CandidateSearchOptions | null>(null);
  const [agent, setAgent] = React.useState<CreatedAgent | null>(null);
  const [calls, setCalls] = React.useState<CallRow[] | null>(null);
  const [launching, setLaunching] = React.useState(false);

  const handleSelectionChange = React.useCallback(
    (candidates: Candidate[], jd: string, opts: CandidateSearchOptions) => {
      setSelected(candidates);
      setJdText(jd);
      setOptions(opts);
    },
    [],
  );

  const handleCallSelected = React.useCallback(async () => {
    if (selected.length === 0 || !jdText.trim()) {
      return;
    }

    setLaunching(true);
    try {
      // Reuse the agent already created from this JD, if any; otherwise
      // build + create one now from the SAME job description.
      let currentAgent = agent;
      if (!currentAgent) {
        const request = buildAgentCreateRequest({
          role: options?.role?.trim() || "this role",
          company: options?.company,
          jdText,
          language: options?.language ?? "ENGLISH",
          persona: options?.persona ?? "NEHA",
        });
        const response = await api.createAgent(request);
        currentAgent = {
          campaignId: response.campaign_id,
          agentId: response.agent_id,
          resultSchema: DEFAULT_RESULT_SCHEMA,
        };
        setAgent(currentAgent);
        toast.success("Voice agent created", {
          description: `Campaign #${currentAgent.campaignId} is ready for candidates.`,
        });
      }

      const candidateInputs: CandidateInput[] = selected.map((c) => ({
        name: c.name,
        phone: c.phone,
        custom_data: {
          title: c.title,
          company: c.company,
          location: c.location,
        },
      }));

      const rows = await api.createCalls(currentAgent.campaignId, candidateInputs);
      const seeded: CallRow[] = rows.map((row, index) => ({
        id: row.id ?? `pending-${index}`,
        callee_name: row.callee_name ?? candidateInputs[index]?.name ?? null,
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
  }, [selected, jdText, options, agent]);

  const canCall = selected.length > 0 && jdText.trim().length > 0 && !launching;

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
        <Badge variant="outline" className="hidden sm:inline-flex">
          Built on Hunar
        </Badge>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-24">
        <section className="flex flex-col gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Users className="size-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            People Reachout
          </h1>
          <p className="max-w-2xl text-muted-foreground text-pretty">
            Paste a job description to search for matching candidates, shortlist the
            ones you like, then launch voice outreach calls — powered by the same
            screening agent and live results dashboard as the Hiring Assistant.
          </p>
        </section>

        <CandidateSearch onSelectionChange={handleSelectionChange} />

        {selected.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="size-4 text-primary" />
                Reach out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {agent
                  ? `Calls will use the screening agent already created for campaign #${agent.campaignId}.`
                  : "We'll build a screening agent from the same job description, then launch calls to your shortlist."}
              </p>
            </CardContent>
            <CardFooter className="justify-between border-t px-6 py-4">
              <Badge variant="outline" className="font-normal">
                {selected.length} candidate{selected.length === 1 ? "" : "s"} shortlisted
              </Badge>
              <Button type="button" onClick={handleCallSelected} disabled={!canCall}>
                {launching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PhoneCall className="size-4" />
                )}
                Call selected
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {agent && calls ? (
          <ResultsTable
            campaignId={agent.campaignId}
            resultSchema={agent.resultSchema}
            initialCalls={calls}
          />
        ) : null}
      </main>
    </div>
  );
}
