"use client";

import * as React from "react";
import { Loader2, Plus, Rocket, Trash2, Upload } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CandidateInput as ApiCandidateInput } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CandidateRow {
  id: string;
  name: string;
  phone: string;
  custom_data?: Record<string, unknown>;
}

export interface CandidateInputProps {
  onLaunch: (candidates: ApiCandidateInput[]) => void | Promise<void>;
  launching?: boolean;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/** Minimal CSV line splitter with basic quoted-field support (no embedded newlines). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

/** Parses `name,phone[,extra columns...]` CSV text into candidate rows. */
export function parseCandidateCsv(text: string): CandidateRow[] {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes("name") && header.includes("phone");

  const nameIdx = hasHeader ? header.indexOf("name") : 0;
  const phoneIdx = hasHeader ? header.indexOf("phone") : 1;
  const extraIdxs = hasHeader
    ? header
        .map((col, idx) => ({ col, idx }))
        .filter(({ col, idx }) => idx !== nameIdx && idx !== phoneIdx && col)
    : [];

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: CandidateRow[] = [];

  for (const line of dataLines) {
    const fields = splitCsvLine(line);
    const name = fields[nameIdx]?.trim() ?? "";
    const phone = fields[phoneIdx]?.trim() ?? "";
    if (!name && !phone) {
      continue;
    }

    let custom_data: Record<string, unknown> | undefined;
    if (extraIdxs.length > 0) {
      custom_data = {};
      for (const { col, idx } of extraIdxs) {
        const value = fields[idx]?.trim();
        if (value) {
          custom_data[col] = value;
        }
      }
      if (Object.keys(custom_data).length === 0) {
        custom_data = undefined;
      }
    }

    rows.push({
      id: `${Date.now()}-${rows.length}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      phone,
      custom_data,
    });
  }

  return rows;
}

function makeRowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CandidateInput({ onLaunch, launching = false }: CandidateInputProps) {
  const [rows, setRows] = React.useState<CandidateRow[]>([]);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddRow = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      return;
    }
    setRows((prev) => [
      ...prev,
      { id: makeRowId(), name: trimmedName, phone: trimmedPhone },
    ]);
    setName("");
    setPhone("");
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCandidateCsv(text);
      if (parsed.length === 0) {
        toast.error("No candidates found in that file", {
          description: "Expected columns: name, phone[, extra fields].",
        });
        return;
      }
      setRows((prev) => [...prev, ...parsed]);
      toast.success(`Added ${parsed.length} candidate${parsed.length === 1 ? "" : "s"} from CSV`);
    } catch {
      toast.error("Couldn't read that file");
    }
  };

  const handleLaunch = async () => {
    if (rows.length === 0) {
      return;
    }
    await onLaunch(
      rows.map((row) => ({
        name: row.name,
        phone: row.phone,
        custom_data: row.custom_data,
      })),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add candidates</CardTitle>
        <CardDescription>
          Add candidates one by one, or upload a CSV with <code>name</code> and{" "}
          <code>phone</code> columns.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          onSubmit={handleAddRow}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="candidate-name">Name</Label>
            <Input
              id="candidate-name"
              placeholder="Priya Sharma"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="candidate-phone">Phone</Label>
            <Input
              id="candidate-phone"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!name.trim() || !phone.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Upload CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <span className="text-sm text-muted-foreground">
            Columns: name, phone[, custom fields]
          </span>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${row.name}`}
                        onClick={() => handleRemoveRow(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-10 text-center">
            <p className="text-sm font-medium text-foreground">No candidates yet</p>
            <p className="text-sm text-muted-foreground">
              Add a candidate above or upload a CSV to get started.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between border-t px-6 py-4">
        <Badge variant="outline" className="font-normal">
          {rows.length} candidate{rows.length === 1 ? "" : "s"}
        </Badge>
        <Button
          type="button"
          data-tour="launch-calls"
          onClick={handleLaunch}
          disabled={rows.length === 0 || launching}
        >
          {launching ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          Start calls
        </Button>
      </CardFooter>
    </Card>
  );
}

export default CandidateInput;
