"use client";

import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncRunStatusBadge, SyncSourceBadge } from "./sync-status-badge";

export interface SyncRunRow {
  id: string;
  source: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  summary: Record<string, unknown> | null;
  errorMessage: string | null;
  triggeredBy: string | null;
  logCount: number;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** Renders the run's counters as compact `key value` pairs. */
function SummaryCells({ summary }: { summary: Record<string, unknown> | null }) {
  if (!summary || Object.keys(summary).length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {Object.entries(summary).map(([key, value]) => (
        <span key={key} className="text-xs">
          <span className="text-muted-foreground">
            {key.replace(/([A-Z])/g, " $1").toLowerCase()}
          </span>{" "}
          <span className="font-medium">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

interface SyncRunsTableProps {
  runs: SyncRunRow[];
  onViewEvents: (runId: string) => void;
}

export function SyncRunsTable({ runs, onViewEvents }: SyncRunsTableProps) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Timer}
        title="No runs recorded yet"
        description="Every cron execution, webhook delivery and manual sync is tracked here once it fires. Crons run on a schedule, so the first entries will appear within minutes."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow
              key={run.id}
              className={cn(run.status === "FAILED" && "bg-destructive/5")}
            >
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(run.startedAt).toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-medium">{run.trigger}</span>
                  <div className="flex items-center gap-1">
                    <SyncSourceBadge source={run.source} />
                    {run.triggeredBy && (
                      <span className="text-xs text-muted-foreground">
                        {run.triggeredBy}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <SyncRunStatusBadge status={run.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDuration(run.durationMs)}
              </TableCell>
              <TableCell className="text-sm font-medium">
                {run.logCount.toLocaleString()}
              </TableCell>
              <TableCell className="max-w-sm">
                {run.errorMessage ? (
                  <span className="text-xs text-destructive">{run.errorMessage}</span>
                ) : (
                  <SummaryCells summary={run.summary} />
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="View this run's events"
                  onClick={() => onViewEvents(run.id)}
                  disabled={run.logCount === 0}
                >
                  <ListTree className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
