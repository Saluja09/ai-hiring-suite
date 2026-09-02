/**
 * Typed API client for the AI Hiring Suite backend (FastAPI).
 *
 * Base URL is read from `NEXT_PUBLIC_API_BASE_URL` (see `.env.example`).
 * All methods throw an `Error` (message = backend `detail`, or a fallback)
 * when the response is not in the 2xx range.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// ---------------------------------------------------------------------------
// Shared enums (mirrors backend/app/schemas.py)
// ---------------------------------------------------------------------------

export type VoicePersona = "NEHA" | "ROY" | "ZOE" | "SAM" | "MIRA" | "EESHA";

export type VoiceLanguage =
  | "ENGLISH"
  | "HINDI"
  | "TAMIL"
  | "TELUGU"
  | "KANNADA"
  | "MARATHI"
  | "MALAYALAM"
  | "GUJARATI"
  | "BENGALI"
  | "TURKISH"
  | "ARABIC"
  | "SPANISH";

export type CallStatus =
  | "NOT_STARTED"
  | "SCHEDULED"
  | "INITIATED"
  | "RINGING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_CONNECTED"
  | "CANCELLED"
  | "FAILED";

// ---------------------------------------------------------------------------
// POST /api/agents
// ---------------------------------------------------------------------------

export interface CreateAgentRequest {
  name: string;
  language?: VoiceLanguage;
  voice_persona: VoicePersona;
  persona_name?: string;
  agent_prompt: string;
  objective: string;
  introduction: string;
  result_prompt?: string | null;
  result_schema: Record<string, unknown>;
  campaign_name?: string | null;
  jd_text?: string | null;
  kind?: string;
}

export interface CreateAgentResponse {
  campaign_id: number;
  agent_id: string;
}

// ---------------------------------------------------------------------------
// POST /api/campaigns/{campaignId}/calls
// ---------------------------------------------------------------------------

export interface CandidateInput {
  name: string;
  phone: string;
  custom_data?: Record<string, unknown>;
}

export interface CallRow {
  id?: string;
  mobile_number: string;
  status?: CallStatus | string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// POST /api/search
// ---------------------------------------------------------------------------

export interface SearchResult {
  name: string;
  title: string;
  company: string;
  location: string;
  phone: string;
  linkedin?: string | null;
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      detail =
        typeof body?.detail === "string"
          ? body.detail
          : JSON.stringify(body?.detail ?? body);
    } catch {
      // response wasn't JSON; fall back to status text
    }
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  // No content responses (204) should not attempt JSON parsing.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const api = {
  /** Create a Hunar voice agent + campaign. */
  createAgent(body: CreateAgentRequest): Promise<CreateAgentResponse> {
    return request<CreateAgentResponse>("/api/agents", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Bulk-create calls for candidates within a campaign. */
  createCalls(
    campaignId: number,
    candidates: CandidateInput[],
  ): Promise<CallRow[]> {
    return request<CallRow[]>(`/api/campaigns/${campaignId}/calls`, {
      method: "POST",
      body: JSON.stringify(candidates),
    });
  },

  /** Search for candidates matching a job description. */
  search(jd: string, limit = 10): Promise<SearchResult[]> {
    return request<SearchResult[]>("/api/search", {
      method: "POST",
      body: JSON.stringify({ jd, limit }),
    });
  },
};

export default api;
