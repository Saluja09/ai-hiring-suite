"use client";

import * as React from "react";
import { Briefcase, Loader2, MapPin, Phone, Search, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { api, type SearchResult, type VoiceLanguage, type VoicePersona } from "@/lib/api";
import { LANGUAGES, PERSONAS } from "@/lib/build-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Candidate extends SearchResult {
  /** Stable identity for selection + React keys (phone isn't guaranteed unique). */
  id: string;
}

export interface CandidateSearchOptions {
  role: string;
  company: string;
  language: VoiceLanguage;
  persona: VoicePersona;
}

export interface CandidateSearchProps {
  onSelectionChange: (
    selected: Candidate[],
    jdText: string,
    options: CandidateSearchOptions,
  ) => void;
}

function candidateId(result: SearchResult, index: number): string {
  return `${result.name}-${result.phone}-${index}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CandidateSearch({ onSelectionChange }: CandidateSearchProps) {
  const [jdText, setJdText] = React.useState("");
  const [role, setRole] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [language, setLanguage] = React.useState<VoiceLanguage>("ENGLISH");
  const [persona, setPersona] = React.useState<VoicePersona>("NEHA");
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const canSearch = jdText.trim().length > 0 && !searching;

  const emitSelection = React.useCallback(
    (ids: Set<string>, candidatePool: Candidate[]) => {
      const selected = candidatePool.filter((c) => ids.has(c.id));
      onSelectionChange(selected, jdText, { role, company, language, persona });
    },
    [onSelectionChange, jdText, role, company, language, persona],
  );

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) {
      return;
    }

    setSearching(true);
    try {
      const raw = await api.search(jdText.trim(), 12);
      const candidates: Candidate[] = raw.map((r, index) => ({
        ...r,
        id: candidateId(r, index),
      }));

      if (candidates.length === 0) {
        toast.error("No candidates found", {
          description: "Try broadening the job description.",
        });
      } else {
        toast.success(`Found ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`);
      }

      setResults(candidates);
      // Default to everyone selected — the recruiter can deselect.
      const allIds = new Set(candidates.map((c) => c.id));
      setSelectedIds(allIds);
      emitSelection(allIds, candidates);
    } catch (error) {
      toast.error("Search failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSearching(false);
    }
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      emitSelection(next, results);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={handleSearch}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4 text-primary" />
              Find candidates
            </CardTitle>
            <CardDescription>
              Paste a job description — we&apos;ll search for matching candidates and
              use the same JD to build your screening agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="search-role">Role (optional)</Label>
                <Input
                  id="search-role"
                  placeholder="Senior Backend Engineer"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  disabled={searching}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="search-company">Company (optional)</Label>
                <Input
                  id="search-company"
                  placeholder="Acme Corp"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  disabled={searching}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5" data-tour="search-jd">
              <Label htmlFor="search-jd">Job description</Label>
              <Textarea
                id="search-jd"
                placeholder="Paste the full job description here…"
                className="min-h-40"
                value={jdText}
                onChange={(event) => setJdText(event.target.value)}
                disabled={searching}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="search-language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(value) => setLanguage(value as VoiceLanguage)}
                  disabled={searching}
                >
                  <SelectTrigger id="search-language" className="w-full">
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
                <Label htmlFor="search-persona">Voice persona</Label>
                <Select
                  value={persona}
                  onValueChange={(value) => setPersona(value as VoicePersona)}
                  disabled={searching}
                >
                  <SelectTrigger id="search-persona" className="w-full">
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
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t px-6 py-4">
            <Button type="submit" data-tour="find-candidates" disabled={!canSearch}>
              {searching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Find candidates
            </Button>
          </CardFooter>
        </form>
      </Card>

      {results.length > 0 ? (
        <Card data-tour="candidate-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Candidates
            </CardTitle>
            <CardDescription>
              Deselect anyone you don&apos;t want to reach out to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((candidate) => {
                const checked = selectedIds.has(candidate.id);
                return (
                  <label
                    key={candidate.id}
                    className={cn(
                      "group flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {candidate.name}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Briefcase className="size-3.5 shrink-0" />
                          {candidate.title}
                          {candidate.company ? ` @ ${candidate.company}` : ""}
                        </span>
                      </div>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCandidate(candidate.id)}
                        aria-label={`Select ${candidate.name}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {candidate.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5 shrink-0" />
                          {candidate.location}
                        </span>
                      ) : null}
                      {candidate.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3.5 shrink-0" />
                          {candidate.phone}
                          {candidate.phone_is_demo ? (
                            <span className="text-[11px] italic opacity-70">
                              (demo number)
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="text-[11px] uppercase tracking-wide opacity-60">
                        {candidate.source === "pdl"
                          ? "Real profile · People Data Labs"
                          : "Sample data"}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="justify-between border-t px-6 py-4">
            <Badge variant="outline" className="font-normal">
              {selectedCount} of {results.length} selected
            </Badge>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}

export default CandidateSearch;
