"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { ResultsTable, type CallRow } from "@/components/results-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TourButton } from "@/components/tour-button";
import { api } from "@/lib/api";
import { LANGUAGES, PERSONAS } from "@/lib/build-agent";
import type { VoiceLanguage, VoicePersona } from "@/lib/api";

const ATTENDANCE_RESULT_SCHEMA: Record<string, string> = {
  present: "string",
  absent: "string",
  late: "string",
  notes: "string",
};

const ARCHITECTURE_DIAGRAM = ` Roster DB (workers × location × supervisor phone × backup contact)
            │
            ▼
   Daily Scheduler (8:00 AM per site, respects call-time guardrails)
            │
            ▼
   Hunar Outbound Voice Agent  ──(retry/escalate on no-answer)──┐
   "Who is present today?"                                     │
            │                                                  │
            ▼                                                  │
   LLM Result Structuring (result_schema:                      │
     present / absent / late / notes)                          │
            │                                                  │
            ▼                                                  │
   Attendance Dashboard (per-location, roll-up to 1,000)  <─────┘
            │
            ▼
   Exceptions Queue (no-answer, low-confidence, disputes)
            │
            ▼
   Human review / backup-contact escalation / spot-check calls`;

interface CreatedRollcall {
  campaignId: number;
  agentId: string;
  call: CallRow;
}

// CallRow above resolves to components/results-table's stricter type
// (id: string, not optional) — the API's CallRow (id?: string) is
// normalized into that shape before being stored below.

export default function AttendancePage() {
  const [location, setLocation] = React.useState("Warehouse A");
  const [supervisorPhone, setSupervisorPhone] = React.useState("");
  const [workerNamesText, setWorkerNamesText] = React.useState(
    "Asha, Ravi, Priya, Kiran",
  );
  const [language, setLanguage] = React.useState<VoiceLanguage>("ENGLISH");
  const [persona, setPersona] = React.useState<VoicePersona>("NEHA");
  const [launching, setLaunching] = React.useState(false);
  const [result, setResult] = React.useState<CreatedRollcall | null>(null);

  const workerNames = React.useMemo(
    () =>
      workerNamesText
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
    [workerNamesText],
  );

  const canSubmit =
    location.trim().length > 0 &&
    supervisorPhone.trim().length > 0 &&
    workerNames.length > 0 &&
    !launching;

  const handleRunRollcall = React.useCallback(async () => {
    if (!canSubmit) return;
    setLaunching(true);
    try {
      const response = await api.attendanceRollcall({
        location: location.trim(),
        supervisor_phone: supervisorPhone.trim(),
        worker_names: workerNames,
        language,
        voice_persona: persona,
      });
      setResult({
        campaignId: response.campaign_id,
        agentId: response.agent_id,
        call: {
          ...response.call,
          id: response.call.id ?? `pending-${response.campaign_id}`,
          status: response.call.status ?? "SCHEDULED",
        },
      });
      toast.success("Roll-call started", {
        description: `Calling the supervisor for ${location.trim()} now.`,
      });
    } catch (error) {
      toast.error("Couldn't start roll-call", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLaunching(false);
    }
  }, [canSubmit, location, supervisorPhone, workerNames, language, persona]);

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
          <TourButton page="attendance" />
          <Badge variant="outline" className="hidden sm:inline-flex">
            Built on Hunar
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 pb-24">
        <section className="flex flex-col gap-3" data-tour="strategy">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <CalendarCheck className="size-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            No-Smartphone Attendance
          </h1>
          <p className="max-w-2xl text-muted-foreground text-pretty">
            If smartphones and apps didn&apos;t exist, but LLMs did — how would
            you track daily attendance for 1,000 people across 100 locations?
            This is our strategy, plus a working voice roll-call PoC that
            reuses the same Hunar call engine as the rest of this suite.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            The key insight
          </h2>
          <p className="text-muted-foreground text-pretty">
            Take away the smartphone and you take away the <em>app</em>, not
            the <em>phone network</em>. Every one of the 100 sites still has a
            basic/feature phone or a landline. And LLMs mean you no longer
            need a screen to capture structured data from a person — a voice
            conversation can now do what a mobile app used to do. Attendance
            stops being an app problem and becomes a{" "}
            <strong className="text-foreground">daily voice roll-call</strong>{" "}
            — exactly Hunar&apos;s thesis that 80% of HR is calling.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Real-world precedent: why app-first attendance fails
          </h2>
          <p className="text-muted-foreground text-pretty">
            This isn&apos;t hypothetical. India ran the world&apos;s largest
            app-first attendance experiment — and rolled it back. Under{" "}
            <strong className="text-foreground">MGNREGA</strong>, paper muster
            rolls were replaced by the National Mobile Monitoring System
            (NMMS) app, requiring{" "}
            <strong className="text-foreground">
              two geo-tagged, time-stamped photos of the workforce per day
            </strong>{" "}
            (mandatory from Jan 2023). On{" "}
            <strong className="text-foreground">8 July 2025</strong> the Union
            Ministry of Rural Development backtracked, ordering manual
            verification after ~4 years.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">It excluded the workers it counted</strong>
              {" "}— where the network was weak, attendance didn&apos;t record.
              At one worksite only 1 of 30 present workers was captured;
              Anganwadi workers walk uphill to find a signal.
            </li>
            <li>
              <strong className="text-foreground">It didn&apos;t stop fraud</strong>
              {" "}— reused/pre-captured photos, app reinstall to skip the
              afternoon photo, and a face-video accepted as &ldquo;live.&rdquo;
            </li>
          </ul>
          <p className="text-muted-foreground text-pretty">
            The lesson, and the core argument for this design: an app-first,
            connectivity-dependent, photo-based system excludes the very
            workers it counts and still doesn&apos;t stop fraud. A voice call
            over the ordinary phone network — no app, no data, no smartphone —
            sidesteps exactly this failure mode. (Sources cited in{" "}
            <code className="text-foreground">docs/attendance-strategy.md</code>.)
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">The design</h2>
          <p className="text-muted-foreground text-pretty">
            Each morning, an outbound multilingual voice AI agent calls the
            site supervisor at each location (supervisors can also
            miss-call a hotline and get called back via IVR). The agent
            greets them, asks &ldquo;who is present today?&rdquo;, lets them
            read out the roster, and the LLM structures the spoken answer
            into per-worker present / absent / late status. The agent reads
            back a summary before hanging up to catch mis-hearing early.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Scale math: 100 calls, not 1,000
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>1,000 workers ÷ 100 locations ≈ 10 workers per site.</li>
            <li>
              The agent calls the 1 supervisor per site, not each worker
              individually → <strong className="text-foreground">100 outbound calls/day</strong>.
            </li>
            <li>
              Each call runs ~2–4 minutes (greeting, roll-call, confirmation
              read-back) → ~300 agent-minutes/day total, dialed concurrently.
            </li>
            <li>
              Compare to an HR person manually calling 100 supervisors —
              realistically 5–8 hours/day of human time, done in minutes here.
            </li>
            <li>
              Hunar&apos;s bulk API supports up to 10,000 recipients per
              batch — 100 sites is comfortably inside its headroom.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Failure modes and mitigations
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Supervisor unreachable</strong> —
              retry with backoff, escalate to a backup contact, flag as
              unreported in an exceptions queue.
            </li>
            <li>
              <strong className="text-foreground">Bad audio / accents</strong> —
              confirmation read-back at the end of the call; low-confidence
              transcriptions route to human review.
            </li>
            <li>
              <strong className="text-foreground">Disputes</strong> — every
              call is recorded; the recording and structured result are
              attached as evidence.
            </li>
            <li>
              <strong className="text-foreground">Poor connectivity</strong> —
              works over the plain voice network; missed-call-to-callback and
              USSD-style fallbacks handle spotty audio.
            </li>
            <li>
              <strong className="text-foreground">Proxy attendance / fraud</strong> —
              random voice spot-checks that call individual workers directly.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Architecture
          </h2>
          <Card>
            <CardContent className="overflow-x-auto">
              <pre className="min-w-max font-mono text-xs leading-relaxed text-muted-foreground">
                {ARCHITECTURE_DIAGRAM}
              </pre>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Why this beats the alternatives
          </h2>
          <p className="text-muted-foreground text-pretty">
            Paper registers don&apos;t aggregate and are easy to fudge.
            Biometric hardware and app-based photo capture need per-site
            capital investment and connectivity you can&apos;t deploy
            overnight across 100 remote sites — precisely what forced
            India&apos;s NMMS rollback. SMS check-ins assume literacy and
            typing comfort. Voice is the one channel that already reaches
            every site (India has ~1.16B mobile subscribers on standard
            telephony), needs no new hardware, and — with an LLM on the other
            end — turns an unstructured conversation into a clean daily
            attendance record.
          </p>
        </section>

        <Card data-tour="rollcall-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="size-4 text-primary" />
              Run roll-call demo
            </CardTitle>
            <CardDescription>
              Dial a real supervisor number and watch the spoken roster come
              back structured, live, in the results table below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Warehouse A"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supervisor-phone">Supervisor phone</Label>
                <Input
                  id="supervisor-phone"
                  value={supervisorPhone}
                  onChange={(e) => setSupervisorPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="worker-names">
                Worker names (comma-separated)
              </Label>
              <Input
                id="worker-names"
                value={workerNamesText}
                onChange={(e) => setWorkerNamesText(e.target.value)}
                placeholder="Asha, Ravi, Priya"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as VoiceLanguage)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Voice persona</Label>
                <Select
                  value={persona}
                  onValueChange={(v) => setPersona(v as VoicePersona)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t px-6 py-4">
            <Badge variant="outline" className="font-normal">
              {workerNames.length} worker{workerNames.length === 1 ? "" : "s"} rostered
            </Badge>
            <Button
              type="button"
              data-tour="run-rollcall"
              onClick={handleRunRollcall}
              disabled={!canSubmit}
            >
              {launching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PhoneCall className="size-4" />
              )}
              Run roll-call demo
            </Button>
          </CardFooter>
        </Card>

        {result ? (
          <div data-tour="attendance-results">
            <ResultsTable
              campaignId={result.campaignId}
              resultSchema={ATTENDANCE_RESULT_SCHEMA}
              initialCalls={[result.call]}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
