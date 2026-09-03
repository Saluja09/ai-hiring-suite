/**
 * Client-only localStorage helper that remembers the "active" campaign for
 * each flow page (hiring / reachout / attendance) so a page refresh can
 * rehydrate the dashboard from the backend instead of resetting to empty
 * in-memory state.
 *
 * Only the CURRENT campaign is tracked (no history list) — saving a new
 * campaign overwrites whatever was previously active for that page.
 */

export type PageKey = "hiring" | "reachout" | "attendance";

interface StoredActiveCampaign {
  campaignId: number;
  resultSchema: Record<string, string>;
}

function storageKey(pageKey: PageKey): string {
  return `active-campaign-${pageKey}`;
}

/** True only in a browser environment where `window.localStorage` exists. */
function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function saveActiveCampaign(
  pageKey: PageKey,
  campaignId: number,
  resultSchema: Record<string, string>,
): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    const payload: StoredActiveCampaign = { campaignId, resultSchema };
    window.localStorage.setItem(storageKey(pageKey), JSON.stringify(payload));
  } catch {
    // Storage can throw (quota, private mode, etc.) — persistence is a nice-to-have.
  }
}

export function loadActiveCampaign(
  pageKey: PageKey,
): StoredActiveCampaign | null {
  if (!hasLocalStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(pageKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredActiveCampaign>;
    if (typeof parsed.campaignId !== "number" || !parsed.resultSchema) {
      return null;
    }
    return {
      campaignId: parsed.campaignId,
      resultSchema: parsed.resultSchema,
    };
  } catch {
    return null;
  }
}

export function clearActiveCampaign(pageKey: PageKey): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey(pageKey));
  } catch {
    // Ignore — nothing meaningful to recover from here.
  }
}
