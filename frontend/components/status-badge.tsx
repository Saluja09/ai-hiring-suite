import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Maps a Hunar call `status` to a tasteful color treatment.
 *
 *  - COMPLETED                       -> green (success)
 *  - IN_PROGRESS / RINGING / INITIATED -> amber/blue (in-flight)
 *  - SCHEDULED / NOT_STARTED         -> muted/gray (pending)
 *  - NOT_CONNECTED / FAILED / CANCELLED -> red (unsuccessful)
 */
const STATUS_STYLES: Record<string, string> = {
  COMPLETED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  IN_PROGRESS:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  RINGING:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  INITIATED:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  SCHEDULED:
    "bg-muted text-muted-foreground border-border",
  NOT_STARTED:
    "bg-muted text-muted-foreground border-border",
  NOT_CONNECTED:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  FAILED:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  CANCELLED:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

const DEFAULT_STYLE = "bg-muted text-muted-foreground border-border";

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status }: { status?: string | null }) {
  const key = (status ?? "").toUpperCase();
  const style = STATUS_STYLES[key] ?? DEFAULT_STYLE;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", style)}
    >
      {status ? humanizeStatus(status) : "Unknown"}
    </Badge>
  );
}

/**
 * Maps a Hunar call `engagement_status` to a tasteful color treatment.
 *
 *  - ENGAGED     -> green
 *  - NOT_ENGAGED -> muted
 *  - null/other  -> muted "—"
 */
const ENGAGEMENT_STYLES: Record<string, string> = {
  ENGAGED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  NOT_ENGAGED: "bg-muted text-muted-foreground border-border",
};

export function EngagementBadge({
  status,
}: {
  status?: string | null;
}) {
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }

  const key = status.toUpperCase();
  const style = ENGAGEMENT_STYLES[key] ?? DEFAULT_STYLE;

  return (
    <Badge variant="outline" className={cn("font-medium", style)}>
      {humanizeStatus(status)}
    </Badge>
  );
}
