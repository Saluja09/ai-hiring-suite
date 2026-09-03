# No-Smartphone Attendance Strategy

**Prompt:** If smartphones and apps didn't exist but LLMs do, how would an HR
manager track daily attendance for 1,000 people across 100 locations?

## The key insight

Take away the smartphone and you take away the *app*, not the *phone
network*. Every one of the 100 sites still has a basic/feature phone or a
landline — that infrastructure has been universal in India for two decades.
And LLMs mean you no longer need a screen or a form to capture structured
data from a person: a **voice conversation** can now do what a mobile app
used to do.

Put those two facts together and attendance stops being an app problem and
becomes a **daily voice roll-call** problem — which is exactly Hunar's
thesis: *80% of HR is calling*. The tool for this job already exists; it
just needs to be pointed at attendance instead of screening. Hunar's own
platform already "functions largely over phone calls" for frontline
workforce management [5] — this design simply extends that operating model
to attendance.

## Real-world precedent: why app-first attendance fails

This isn't hypothetical. India ran the largest app-first attendance
experiment in the world — and rolled it back.

Under **MGNREGA** (the national rural employment guarantee scheme), paper
muster rolls were replaced by the **National Mobile Monitoring System
(NMMS)** app, which required supervisors to upload **two geo-tagged,
time-stamped photographs of the workforce per day, taken about four hours
apart** — mandatory from **1 January 2023** [1]. On paper it was a
modern, tamper-proof digital system.

In practice it failed on both counts — inclusion *and* fraud — and on
**8 July 2025 the Union Ministry of Rural Development backtracked**,
issuing a directive requiring **manual verification** of the digital
records after roughly four years of digital-first operation [2]. The
documented failure modes are instructive:

- **It excluded the workers it was counting.** The app's smartphone-and-
  connectivity dependency meant that where the network was weak, attendance
  simply didn't record — at one worksite only **1 of 30 present workers**
  was captured, and Anganwadi workers have been reported **walking uphill to
  find a signal** to complete uploads [3][9].
- **It didn't even stop fraud.** Supervisors uploaded pre-captured or reused
  photos, recycled identical photos across muster rolls, and uninstalled/
  reinstalled the app to skip the afternoon photo; the later face-based
  version could even accept a *video* of a worker's face as "live" [3].

The lesson is the core argument for this design: an app-first, smartphone-
and-connectivity-dependent, photo-based system **excludes the very workers
it counts and still doesn't stop fraud**. A **voice call over the ordinary
phone network** — no app, no data, no smartphone, works on any feature
phone — sidesteps exactly this failure mode. That is precisely the gap a
voice-AI roll-call fills.

## The design

Each morning, an outbound multilingual voice AI agent calls the **site
supervisor** at each of the 100 locations (supervisors can also miss-call a
hotline and get called back — an inbound IVR path for sites with unreliable
outbound reach). The agent:

1. Greets the supervisor and asks, in their preferred regional language,
   *"who is present today?"*
2. Lets the supervisor read the roster out loud, worker by worker.
3. Uses the LLM to structure the spoken roster into
   `present / absent / late` per worker, plus free-text `notes` (reasons,
   replacements, etc.).
4. **Reads back a summary** — "So that's 8 present, 1 absent (Ravi), 1 late
   (Asha) — confirm?" — before ending the call, to catch mis-hearing before
   it becomes a bad record.

This mirrors the proven Hunar building blocks: multilingual voice (12
languages — Hindi, Tamil, Telugu, Marathi, etc.), retry logic, call-time
guardrails (only call during agreed shift-start windows), and structured
result extraction — all already live in this codebase.

The "call from a known number" mechanic is itself an established
verification pattern: commercial **IVR phone-based time clocks** already let
field staff clock in and out by *calling a designated number from an
approved phone* and following voice prompts — with the phone number itself
acting as a job-site checkpoint, no GPS or app required [4]. We apply the
same idea at the supervisor level: the roster binds each site to a known
supervisor number, and the roll-call runs against it.

## Scale math: why 100 calls, not 1,000

The trick is to roster **by location**, not by worker:

- 1,000 workers ÷ 100 locations ≈ **10 workers per site**.
- The agent calls the **1 supervisor per site**, not each individual worker
  → **100 outbound calls/day**, not 1,000.
- Each call: ~30–60s greeting/setup + ~10 workers × ~10–15s each to call out
  a name and status + ~20–30s confirmation read-back ≈ **2–4 minutes/call**.
- Total: 100 calls × ~3 min average ≈ **~300 agent-minutes/day**, run
  concurrently in a tight morning window (e.g. 8:00–8:30 AM), so wall-clock
  time is minutes, not hours.
- Compare to the manual alternative: an HR person personally calling 100
  supervisors, each taking 3–5 minutes plus dial/hold time, realistically
  consumes 5–8 **hours** of a human's day, every day. The voice agent does
  it in parallel, before the HR team has finished their coffee.
- Hunar's bulk API supports up to 10,000 recipients in a single batch with
  concurrent dialing — 100 (or even 1,000, if we ever *did* want to call
  every worker directly for spot verification) is comfortably inside its
  headroom.

## Failure modes and mitigations

| Failure mode | Mitigation |
|---|---|
| Supervisor doesn't pick up | Auto-retry with backoff (2–3 attempts within the call window); escalate to a named backup contact at the site; flag as "unreported" in the exceptions queue if all contacts fail. |
| Bad audio / regional accent / background noise | Confirmation read-back at end of call; any name transcribed with low confidence is routed to a human review queue instead of silently auto-filed. |
| Supervisor–worker disputes ("I called that in!") | Every call is recorded; the recording URL and structured result are attached to that day's attendance record as evidence. |
| Poor connectivity at remote sites | Feature-phone/basic-phone calling works over the standard voice network (no data needed) — the exact failure that broke MGNREGA's app is designed out here. A **missed-call-to-callback** fallback (the supervisor gives a missed call and the system rings back within ~a minute) is a proven Indian pattern — Gram Vaani's *Mobile Vaani* runs entirely on it, since incoming calls are free in India [6][7]; a USSD-style "press 1 for present, 2 for absent" path handles heavy background noise. |
| Proxy / fraudulent attendance (supervisor rubber-stamping, buddy-punching) | Even India's photo-and-face system was defeated by proxy loopholes [3], so no single signal is trusted: periodic random voice spot-checks call 2–3 individual workers directly; pattern-detection flags suspiciously identical daily rosters; call recordings serve as dispute evidence. |
| Ghost workers (names on the roll that don't exist) | Bind each roster entry to a verified identity at enrolment (Aadhaar/e-KYC-style seeding is the countermeasure India itself uses against duplicate/fake job cards) so the roll-call runs against real people, not padded lists [10]. |

## Architecture

```
 Roster DB (workers × location × supervisor phone × backup contact)
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
   Human review / backup-contact escalation / spot-check calls
```

## Cost framing

At ~300 agent-minutes/day for the full 1,000-person, 100-location
operation, this is a small, predictable Hunar minutes line item —
dramatically cheaper than 100 daily HR-staff-hours, and it scales linearly
(and near-instantly) if headcount or site count grows, since the bottleneck
is API concurrency, not people.

## Why this beats the alternatives

- **Paper registers**: no aggregation, no real-time visibility, easy to
  fudge, expensive to collect and reconcile across 100 sites.
- **Biometric hardware / app-based photo capture**: requires per-site capital
  investment, installation, maintenance, and power/connectivity at every
  location — infeasible to deploy overnight across 100 remote sites, and
  still useless without an app or network to report the data back. This is
  not a theoretical objection: it is precisely what forced India's NMMS
  rollback [2][3].
- **SMS-based check-in**: assumes literacy and typing comfort, and still
  needs a way to structure free-text replies from 100 different people —
  which is the same LLM-structuring problem, minus the accessibility of
  voice.

Voice is the one channel that already reaches every site, requires no new
hardware, needs no literacy or typing, and — with an LLM on the other end —
can finally turn an unstructured conversation into a clean daily attendance
record. And the reach is already there: India has ~1.16 billion active
mobile subscribers, and Indian voice-AI runs on standard TRAI-compliant
telephony with no app required [8], so a phone-network roll-call is
immediately deployable at national scale.

## Sources

1. ThePrint — *Modi govt plans face authentication for MGNREGS attendance*
   (NMMS: two geo-tagged, time-stamped photos/day, mandatory 1 Jan 2023):
   https://theprint.in/india/governance/modi-govt-plans-face-authentication-for-mgnregs-attendance-eyes-2024-launch/1887436/
2. Down To Earth — *Rural ministry backtracks on digital-first attendance
   for MGNREGS workers after misuse and manipulation* (8 Jul 2025 manual-
   verification directive):
   https://www.downtoearth.org.in/governance/rural-ministry-backtracks-on-digital-first-attendance-system-for-mgnregs-workers-after-misuse-and-manipulation-instances
3. The Wire — *NMMS Didn't End Corruption in MGNREGA. It Changed Its Shape
   and Locked Workers Out* (1-of-30 capture; proxy loopholes):
   https://thewire.in/labour/nmms-didnt-end-corruption-in-mgnrega-it-changed-its-shape-and-locked-workers-out
4. Chronotek — *IVR employee time clock for field teams* (call-from-approved-
   number checkpoint, no app):
   https://www.chronotek.com/blog/ivr-employee-time-clock-field-teams
5. ElevenLabs — *Hunar AI* case study ("functions largely over phone calls"):
   https://elevenlabs.io/blog/hunar
6. Gram Vaani — *Ringing in change* (Mobile Vaani free missed-call IVR):
   https://gramvaani.org/ringing-in-change/
7. Slate — *How missed calls became a COVID lifeline in rural India*
   (missed-call callback model; incoming calls free):
   https://slate.com/technology/2021/06/mobile-vaani-missed-calls-rural-india-covid.html
8. Ozonetel — *Best voicebot platforms* (TRAI-compliant telephony, no app;
   ~1.16B subscribers): https://ozonetel.com/best-voicebot-platforms/ and
   PIB / NIC on NMMS: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1845371
9. The News Minute — *Facial recognition on Poshan app: Anganwadi workers
   fear exclusion* (connectivity failures in the field):
   https://www.thenewsminute.com/news/facial-recognition-on-poshan-app-anganwadi-workers-and-activists-fear-exclusion-privacy-risks
10. Organiser — *Govt tightens MGNREGA monitoring: Aadhaar e-KYC to eliminate
    ghost workers* (identity binding against fake job cards):
    https://organiser.org/2025/11/23/327092/bharat/govt-tightens-mgnrega-monitoring-aadhaar-e-kyc-to-eliminate-ghost-workers-and-safeguard-genuine-labour/

*Note on sourcing: the NMMS photo mandate [1], the IVR checkpoint model [4],
Hunar's phone-first operation [5], and the missed-call callback pattern
[6][7] were independently (adversarially) verified during research. The
July 2025 manual-verification backtrack [2] and the field-failure and
anti-fraud details [3][9][10] come from credible outlets (Down To Earth,
The Wire, The News Minute, Organiser) but were gathered during a partial
research run and were not adversarially re-confirmed — treat them as
well-sourced but not independently double-checked here.*
