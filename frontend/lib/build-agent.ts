/**
 * Shared "build an AgentCreate request from a JD + options" logic.
 *
 * Single source of truth for the standard screening result_schema and the
 * generated prompt/introduction copy — consumed by both `agent-builder.tsx`
 * (Task 14, Flow 1) and the `/people-reachout` page (Task 15, Flow 2) so
 * they stay byte-for-byte consistent.
 */

import type { CreateAgentRequest, VoiceLanguage, VoicePersona } from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LANGUAGES: { value: VoiceLanguage; label: string }[] = [
  { value: "ENGLISH", label: "English" },
  { value: "HINDI", label: "Hindi" },
  { value: "TAMIL", label: "Tamil" },
  { value: "TELUGU", label: "Telugu" },
  { value: "KANNADA", label: "Kannada" },
  { value: "MARATHI", label: "Marathi" },
  { value: "MALAYALAM", label: "Malayalam" },
  { value: "GUJARATI", label: "Gujarati" },
  { value: "BENGALI", label: "Bengali" },
  { value: "TURKISH", label: "Turkish" },
  { value: "ARABIC", label: "Arabic" },
  { value: "SPANISH", label: "Spanish" },
];

export const PERSONAS: { value: VoicePersona; label: string }[] = [
  { value: "NEHA", label: "Neha" },
  { value: "ROY", label: "Roy" },
  { value: "ZOE", label: "Zoe" },
  { value: "SAM", label: "Sam" },
  { value: "MIRA", label: "Mira" },
  { value: "EESHA", label: "Eesha" },
];

/** Standard screening result schema — keep in sync with the backend's deterministic builder. */
export const DEFAULT_RESULT_SCHEMA: Record<string, string> = {
  years_experience: "number",
  available_immediately: "boolean",
  expected_salary: "string",
  willing_to_relocate: "boolean",
  interested: "boolean",
  summary: "string",
};

export function personaDisplayName(persona: VoicePersona): string {
  const found = PERSONAS.find((p) => p.value === persona);
  return found ? found.label : "Neha";
}

/** "Screening — Senior Backend Engineer" truncated to [3, 64] chars. */
export function buildAgentName(role: string): string {
  const trimmedRole = role.trim() || "Role";
  let name = `Screening — ${trimmedRole}`;
  if (name.length > 64) {
    name = name.slice(0, 64).trimEnd();
  }
  if (name.length < 3) {
    name = name.padEnd(3, ".");
  }
  return name;
}

export function buildAgentPrompt(
  role: string,
  company: string,
  jdText: string,
): string {
  const trimmedRole = role.trim() || "the role";
  const trimmedCompany = company.trim() || "the company";
  return [
    `You are a friendly recruiting screener calling on behalf of ${trimmedCompany} about the ${trimmedRole} role.`,
    "Use the job description below to ground your questions and answer any clarifying questions the candidate has.",
    "",
    "Job description:",
    jdText.trim(),
    "",
    "During the call, politely ask the candidate about:",
    "1. Their relevant years of experience for this role.",
    "2. Whether they are available to join immediately, and if not, their notice period.",
    "3. Their expected salary or compensation range.",
    "4. Whether they are willing to relocate (if applicable to this role).",
    "5. Their overall interest level in moving forward with this opportunity.",
    "",
    "Keep the tone warm, concise, and respectful of the candidate's time. Do not make any commitments on behalf of the company.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Shared "build the AgentCreate body" entry point
// ---------------------------------------------------------------------------

export interface BuildAgentOptions {
  role: string;
  company?: string;
  jdText: string;
  language: VoiceLanguage;
  persona: VoicePersona;
}

/**
 * Builds a full `CreateAgentRequest` from a JD + a handful of options,
 * using the standard 6-field result_schema and generated prompt/intro copy.
 */
export function buildAgentCreateRequest({
  role,
  company,
  jdText,
  language,
  persona,
}: BuildAgentOptions): CreateAgentRequest {
  const personaName = personaDisplayName(persona);
  const trimmedRole = role.trim();
  const trimmedCompany = company?.trim() || "our company";
  const name = buildAgentName(trimmedRole);

  return {
    name,
    language,
    voice_persona: persona,
    persona_name: personaName,
    introduction: `Hi {callee_name}, this is ${personaName} from ${trimmedCompany} about the ${trimmedRole} role. Do you have 2 minutes?`,
    agent_prompt: buildAgentPrompt(trimmedRole, trimmedCompany, jdText),
    objective: `Screen candidates for the ${trimmedRole} role.`,
    result_prompt:
      "From the conversation, extract the candidate's answers as JSON matching the schema.",
    result_schema: DEFAULT_RESULT_SCHEMA,
    campaign_name: name,
    jd_text: jdText.trim(),
    kind: "hiring",
  };
}
