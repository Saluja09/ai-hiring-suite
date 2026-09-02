"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { api, type VoiceLanguage, type VoicePersona } from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGES: { value: VoiceLanguage; label: string }[] = [
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

const PERSONAS: { value: VoicePersona; label: string }[] = [
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

function personaDisplayName(persona: VoicePersona): string {
  const found = PERSONAS.find((p) => p.value === persona);
  return found ? found.label : "Neha";
}

/** "Screening — Senior Backend Engineer" truncated to [3, 64] chars. */
function buildAgentName(role: string): string {
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

function buildAgentPrompt(role: string, company: string, jdText: string): string {
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
// Component
// ---------------------------------------------------------------------------

export interface AgentBuiltResult {
  campaignId: number;
  agentId: string;
  resultSchema: Record<string, string>;
  persona: VoicePersona;
  language: VoiceLanguage;
  role: string;
}

export interface AgentBuilderProps {
  onAgentBuilt: (result: AgentBuiltResult) => void;
}

export function AgentBuilder({ onAgentBuilt }: AgentBuilderProps) {
  const [role, setRole] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [jdText, setJdText] = React.useState("");
  const [language, setLanguage] = React.useState<VoiceLanguage>("ENGLISH");
  const [persona, setPersona] = React.useState<VoicePersona>("NEHA");
  const [submitting, setSubmitting] = React.useState(false);
  const [built, setBuilt] = React.useState<AgentBuiltResult | null>(null);

  const canSubmit = role.trim().length > 0 && jdText.trim().length > 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    try {
      const personaName = personaDisplayName(persona);
      const trimmedRole = role.trim();
      const trimmedCompany = company.trim() || "our company";

      const response = await api.createAgent({
        name: buildAgentName(trimmedRole),
        language,
        voice_persona: persona,
        persona_name: personaName,
        introduction: `Hi {callee_name}, this is ${personaName} from ${trimmedCompany} about the ${trimmedRole} role. Do you have 2 minutes?`,
        agent_prompt: buildAgentPrompt(trimmedRole, trimmedCompany, jdText),
        objective: `Screen candidates for the ${trimmedRole} role.`,
        result_prompt:
          "From the conversation, extract the candidate's answers as JSON matching the schema.",
        result_schema: DEFAULT_RESULT_SCHEMA,
        campaign_name: buildAgentName(trimmedRole),
        jd_text: jdText.trim(),
        kind: "hiring",
      });

      const result: AgentBuiltResult = {
        campaignId: response.campaign_id,
        agentId: response.agent_id,
        resultSchema: DEFAULT_RESULT_SCHEMA,
        persona,
        language,
        role: trimmedRole,
      };

      setBuilt(result);
      toast.success("Voice agent created", {
        description: `Campaign #${response.campaign_id} is ready for candidates.`,
      });
      onAgentBuilt(result);
    } catch (error) {
      toast.error("Couldn't create the agent", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Build your screening agent
          </CardTitle>
          <CardDescription>
            Paste a job description and pick a voice — we&apos;ll generate a screening
            script and result schema automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                placeholder="Senior Backend Engineer"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={submitting || !!built}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Acme Corp"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                disabled={submitting || !!built}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jd">Job description</Label>
            <Textarea
              id="jd"
              placeholder="Paste the full job description here…"
              className="min-h-40"
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              disabled={submitting || !!built}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="language">Language</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as VoiceLanguage)}
                disabled={submitting || !!built}
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="persona">Voice persona</Label>
              <Select
                value={persona}
                onValueChange={(value) => setPersona(value as VoicePersona)}
                disabled={submitting || !!built}
              >
                <SelectTrigger id="persona" className="w-full">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {built ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground">
                Agent generated for campaign #{built.campaignId}
              </p>
              <p className="text-sm text-muted-foreground">
                {personaDisplayName(built.persona)} ·{" "}
                {LANGUAGES.find((l) => l.value === built.language)?.label} · extracts:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(built.resultSchema).map(([key, type]) => (
                  <Badge key={key} variant="outline" className="font-normal">
                    {key}
                    <span className="text-muted-foreground">: {type}</span>
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t px-6 py-4">
          {built ? (
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3" />
              Agent ready
            </Badge>
          ) : (
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Build agent
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

export default AgentBuilder;
