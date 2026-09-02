"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EngagementBadge, StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { subscribe } from "@/lib/sse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallRow {
  id: string;
  callee_name?: string | null;
  mobile_number?: string | null;
  status?: string | null;
  lifecycle_status?: string | null;
  engagement_status?: string | null;
  answered_by?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: Record<string, any> | null;
}

export interface ResultsTableProps {
  campaignId?: number | null;
  resultSchema: Record<string, string>;
  initialCalls: CallRow[];
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "years_experience" -> "Years Experience" */
function humanizeKey(key: string): string {
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** 31 -> "31s", 62 -> "1m 2s" */
function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "—";
  }
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (minutes === 0) {
    return `${remainder}s`;
  }
  return `${minutes}m ${remainder}s`;
}

function BooleanPill({ value }: { value: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        value
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {value ? "Yes" : "No"}
    </Badge>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResultCell({ value, type }: { value: any; type: string }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (type === "boolean") {
    return <BooleanPill value={Boolean(value)} />;
  }

  if (type === "number") {
    return <span className="tabular-nums">{String(value)}</span>;
  }

  return <span>{String(value)}</span>;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows: CallRow[], schemaKeys: string[]): string {
  const headers = [
    "Candidate",
    "Phone",
    "Status",
    "Engagement",
    "Duration",
    "Recording",
    ...schemaKeys.map(humanizeKey),
  ];

  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    const fields = [
      row.callee_name ?? "",
      row.mobile_number ?? "",
      row.status ?? "",
      row.engagement_status ?? "",
      formatDuration(row.duration_seconds),
      row.recording_url ?? "",
      ...schemaKeys.map((key) => {
        const value = row.result?.[key];
        return value === null || value === undefined ? "" : value;
      }),
    ];
    lines.push(fields.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResultsTable({
  campaignId,
  resultSchema,
  initialCalls,
}: ResultsTableProps) {
  const [calls, setCalls] = React.useState<CallRow[]>(initialCalls);

  const schemaKeys = React.useMemo(
    () => Object.keys(resultSchema ?? {}),
    [resultSchema],
  );

  React.useEffect(() => {
    setCalls(initialCalls);
    // Only reset from props when the underlying call list identity changes;
    // live updates below merge into the current state independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCalls]);

  React.useEffect(() => {
    if (campaignId === undefined || campaignId === null) {
      return;
    }

    const unsubscribe = subscribe(campaignId, (data: CallRow) => {
      if (!data || !data.id) {
        return;
      }
      setCalls((prev) => {
        const index = prev.findIndex((call) => call.id === data.id);
        if (index === -1) {
          return [...prev, data];
        }
        const next = [...prev];
        next[index] = { ...next[index], ...data };
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [campaignId]);

  const handleExport = () => {
    const csv = buildCsv(calls, schemaKeys);
    downloadCsv(csv, `campaign-${campaignId ?? "results"}.csv`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Results</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={calls.length === 0}
          >
            Export CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              No calls yet
            </p>
            <p className="text-sm text-muted-foreground">
              Calls will appear here as they are scheduled and completed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Recording</TableHead>
                  {schemaKeys.map((key) => (
                    <TableHead
                      key={key}
                      className={
                        resultSchema[key] === "number" ? "text-right" : ""
                      }
                    >
                      {humanizeKey(key)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-medium">
                      {call.callee_name || "—"}
                    </TableCell>
                    <TableCell>{call.mobile_number || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={call.status} />
                    </TableCell>
                    <TableCell>
                      <EngagementBadge status={call.engagement_status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(call.duration_seconds)}
                    </TableCell>
                    <TableCell>
                      {call.recording_url ? (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          Listen
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {schemaKeys.map((key) => (
                      <TableCell
                        key={key}
                        className={
                          resultSchema[key] === "number" ? "text-right" : ""
                        }
                      >
                        <ResultCell
                          value={call.result?.[key]}
                          type={resultSchema[key]}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ResultsTable;
