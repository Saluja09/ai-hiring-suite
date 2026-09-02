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
just needs to be pointed at attendance instead of screening.

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
| Poor connectivity at remote sites | Feature-phone/basic-phone calling works over the standard voice network (no data needed); missed-call-to-callback and USSD-style "press 1 for present, 2 for absent" fallbacks work even with heavy background noise or spotty audio. |
| Proxy / fraudulent attendance (supervisor rubber-stamping) | Periodic random voice spot-checks that call 2–3 individual workers directly to confirm they're on-site; pattern-detection on suspiciously identical daily rosters. |

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
- **Biometric hardware**: requires per-site capital investment, installation,
  maintenance, and power/connectivity at every location — infeasible to
  deploy overnight across 100 remote sites, and still useless without an app
  or network to report the data back.
- **SMS-based check-in**: assumes literacy and typing comfort, and still
  needs a way to structure free-text replies from 100 different people —
  which is the same LLM-structuring problem, minus the accessibility of
  voice.

Voice is the one channel that already reaches every site, requires no new
hardware, needs no literacy or typing, and — with an LLM on the other end —
can finally turn an unstructured conversation into a clean daily attendance
record.
