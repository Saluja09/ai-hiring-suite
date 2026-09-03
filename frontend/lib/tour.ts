"use client";

/**
 * Guided product tour engine, powered by driver.js.
 *
 * Per-page step definitions live in `TOURS`, keyed by a page id. Each page
 * ships:
 *  - a replayable tour via `startTour(page)` (wired to the "Take a tour"
 *    button), and
 *  - a first-visit auto-start via `maybeAutoStartTour(page)`, gated on a
 *    `localStorage` "seen" flag so it only ever runs once per browser.
 *
 * driver.js is DOM-only, so every export here is safe to call from a client
 * component but guards `typeof window` so importing this module during SSR
 * (e.g. from a Server Component that re-exports types) never throws.
 */

import "driver.js/dist/driver.css";
import "./tour.css";

import { driver, type Config, type Driver, type DriveStep } from "driver.js";

export type TourPage =
  | "landing"
  | "hiring-assistant"
  | "people-reachout"
  | "attendance";

const SEEN_KEY_PREFIX = "tour-seen-";
const AUTO_START_DELAY_MS = 600;

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const TOURS: Record<TourPage, DriveStep[]> = {
  landing: [
    {
      popover: {
        title: "Welcome to AI Hiring Suite",
        description:
          "Three voice-AI workflows, one control plane. Let's take a 30-second look at where to start.",
      },
    },
    {
      element: '[data-tour="card-hiring"]',
      popover: {
        title: "Hiring Assistant",
        description:
          "Click here to turn a job description into a multilingual voice agent that screens candidates automatically — you'll build the agent, add candidates, and watch call results stream in live.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="card-reachout"]',
      popover: {
        title: "People Reachout",
        description:
          "Click here to search a candidate pool by job description, shortlist the ones you like, and launch bulk outbound calls to them.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="card-attendance"]',
      popover: {
        title: "Attendance",
        description:
          "Click here to see (and try) a no-smartphone attendance strategy — a daily voice roll-call that calls a site supervisor instead of relying on an app.",
        side: "bottom",
        align: "start",
      },
    },
    {
      popover: {
        title: "Pick one to start",
        description:
          "Every page has its own \"Take a tour\" button if you want a refresher later. Go ahead and open one of the three cards above.",
      },
    },
  ],

  "hiring-assistant": [
    {
      popover: {
        title: "Hiring Assistant",
        description:
          "Build a voice screening agent from a job description, add candidates, then watch calls complete live. Let's walk through it.",
      },
    },
    {
      element: '[data-tour="agent-form"]',
      popover: {
        title: "Describe the role",
        description:
          "Paste a job description and pick a language and voice persona. We'll turn this into a real multilingual Hunar voice agent — including the exact questions it asks candidates.",
        side: "top",
        align: "start",
      },
    },
    {
      element: '[data-tour="create-agent"]',
      popover: {
        title: "Build agent",
        description:
          "Click here to create the voice agent on Hunar. It also generates the result extraction schema — the fields the agent will pull out of every call.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="candidates"]',
      popover: {
        title: "Add candidates",
        description:
          "Add candidates one by one, or upload a CSV. Phone numbers are normalized automatically, so you don't need to worry about formatting.",
        side: "top",
        align: "start",
      },
    },
    {
      element: '[data-tour="launch-calls"]',
      popover: {
        title: "Start calls",
        description:
          "This places real calls to every candidate above. Watch the results table below fill in live as each call completes.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="results"]',
      popover: {
        title: "Live results",
        description:
          "One row per candidate. Columns are generated from what the agent extracts — status, engagement, and each answer stream in live as calls finish.",
        side: "top",
        align: "start",
      },
    },
  ],

  "people-reachout": [
    {
      popover: {
        title: "People Reachout",
        description:
          "Search candidates by job description, shortlist them, and launch outbound calls — all from one page. Let's walk through it.",
      },
    },
    {
      element: '[data-tour="search-jd"]',
      popover: {
        title: "Describe who you're looking for",
        description:
          "Paste a job description here. It's used both to search the candidate pool and, later, to build the screening agent that calls your shortlist.",
        side: "top",
        align: "start",
      },
    },
    {
      element: '[data-tour="find-candidates"]',
      popover: {
        title: "Find candidates",
        description:
          "Click here to search. Matching candidates appear below as selectable cards — everyone is selected by default, so you just deselect anyone you don't want.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="candidate-results"]',
      popover: {
        title: "Review your shortlist",
        description:
          "Each card shows the candidate's title, company, and contact info. Uncheck anyone you don't want to reach out to.",
        side: "top",
        align: "start",
      },
    },
    {
      element: '[data-tour="call-selected"]',
      popover: {
        title: "Call selected",
        description:
          "Click here to build (or reuse) a screening agent from your job description and place real calls to everyone still selected.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="reachout-results"]',
      popover: {
        title: "Live results",
        description:
          "One row per candidate you called. Status, engagement, and extracted answers stream in live as each call completes.",
        side: "top",
        align: "start",
      },
    },
  ],

  attendance: [
    {
      popover: {
        title: "No-Smartphone Attendance",
        description:
          "A working voice roll-call proof-of-concept, plus the strategy behind it. Let's take a quick look.",
      },
    },
    {
      element: '[data-tour="strategy"]',
      popover: {
        title: "The strategy",
        description:
          "Read here for the reasoning: why an app-first attendance system excludes the workers it's meant to count, and why a plain voice call over the existing phone network avoids that failure mode.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: '[data-tour="rollcall-form"]',
      popover: {
        title: "Run the roll-call demo",
        description:
          "Enter a real supervisor phone number, a location, and the worker roster. This isn't a mock — it places an actual outbound call and asks the supervisor who's present today.",
        side: "top",
        align: "start",
      },
    },
    {
      element: '[data-tour="run-rollcall"]',
      popover: {
        title: "Run roll-call demo",
        description:
          "Click here to place the call. The agent greets the supervisor, takes the roll call, and reads back a summary before hanging up.",
        side: "top",
        align: "center",
      },
    },
    {
      element: '[data-tour="attendance-results"]',
      popover: {
        title: "Live results",
        description:
          "The structured attendance result — present, absent, late, and any notes — streams in here once the call completes.",
        side: "top",
        align: "start",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const BASE_CONFIG: Config = {
  showProgress: true,
  animate: true,
  smoothScroll: true,
  allowClose: true,
  skipMissingElement: true,
  overlayOpacity: 0.55,
  stagePadding: 6,
  stageRadius: 8,
  popoverClass: "ai-hiring-tour-popover",
  nextBtnText: "Next",
  prevBtnText: "Back",
  doneBtnText: "Done",
};

/**
 * Filters step definitions down to elements that actually exist in the DOM
 * right now (steps with no `element` — plain intro/outro popovers — always
 * pass through). This keeps a tour from stalling or crashing if a target,
 * like a results table that only mounts after a call is launched, isn't
 * present yet.
 */
function resolveSteps(steps: DriveStep[]): DriveStep[] {
  if (typeof document === "undefined") {
    return [];
  }
  return steps.filter((step) => {
    if (!step.element) {
      return true;
    }
    const selector =
      typeof step.element === "string" ? step.element : undefined;
    if (!selector) {
      return true;
    }
    return document.querySelector(selector) !== null;
  });
}

// Module-level reference to whichever driver.js instance is currently
// driving a tour (if any), so we never end up with two overlays stacked on
// top of each other.
let activeTourDriver: Driver | null = null;

/** Destroys the currently active tour instance, if there is one. */
function destroyActiveTour(): void {
  if (activeTourDriver && activeTourDriver.isActive()) {
    activeTourDriver.destroy();
  }
  activeTourDriver = null;
}

/** Starts (or replays) the guided tour for a given page. */
export function startTour(page: TourPage): void {
  if (typeof window === "undefined") {
    return;
  }

  // Never stack two tours: close out any tour that's already running before
  // starting a new one (covers rapid "Take a tour" clicks and replay-while-
  // active).
  destroyActiveTour();

  const steps = resolveSteps(TOURS[page] ?? []);
  if (steps.length === 0) {
    return;
  }

  const tourDriver = driver({
    ...BASE_CONFIG,
    steps,
  });

  activeTourDriver = tourDriver;
  tourDriver.drive();
}

function seenKey(page: TourPage): string {
  return `${SEEN_KEY_PREFIX}${page}`;
}

// Tracks the pending auto-start timer (if any) at module scope, so a second
// invocation of `maybeAutoStartTour` (e.g. React StrictMode's double-invoked
// dev-mode effect) can see — and callers can cancel — the first one.
let pendingAutoStartTimer: number | null = null;

/**
 * Starts the tour automatically on a visitor's first visit to `page`, then
 * remembers it was seen so it never auto-starts again on this browser. Safe
 * to call from a `useEffect` on every mount — it's a no-op after the first
 * time. SSR-safe (no-op when `window`/`localStorage` aren't available).
 *
 * The `tour-seen-{page}` flag is written synchronously at schedule time
 * (not after the delay elapses), so a second call made before the timer
 * fires — e.g. StrictMode's mount→cleanup→remount, or two rapid mounts —
 * sees the flag already set and does not schedule a second timer.
 */
export function maybeAutoStartTour(page: TourPage): void {
  if (typeof window === "undefined") {
    return;
  }

  let alreadySeen = true;
  try {
    alreadySeen = window.localStorage.getItem(seenKey(page)) !== null;
  } catch {
    // localStorage can throw in locked-down environments (e.g. private
    // browsing in some browsers) — treat as "seen" so we fail closed and
    // never annoy the user with a tour we can't remember dismissing.
    return;
  }

  if (alreadySeen) {
    return;
  }

  try {
    window.localStorage.setItem(seenKey(page), "1");
  } catch {
    // Ignore write failures — worst case the tour auto-starts again.
  }

  pendingAutoStartTimer = window.setTimeout(() => {
    pendingAutoStartTimer = null;
    startTour(page);
  }, AUTO_START_DELAY_MS);
}

/**
 * Cancels a pending auto-start timer, if one is scheduled. Intended to be
 * returned as a `useEffect` cleanup so StrictMode's dev-mode cleanup (or an
 * unmount before the delay elapses) cancels the first timer rather than
 * letting it fire alongside a second one.
 */
export function cancelPendingAutoStartTour(): void {
  if (pendingAutoStartTimer !== null) {
    window.clearTimeout(pendingAutoStartTimer);
    pendingAutoStartTimer = null;
  }
}
