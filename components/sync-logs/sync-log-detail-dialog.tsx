"use client";

import { Copy, ExternalLink, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SYNC_TYPE_LABELS } from "@/config/sync-logs";
import {
  DryRunBadge,
  SyncSourceBadge,
  SyncStatusBadge,
} from "./sync-status-badge";

export interface SyncLogRow {
  id: string;
  syncType: string;
  platform: string;
  status: string;
  direction: string;
  source: string;
  runId: string | null;
  runTrigger: string | null;
  sku: string | null;
  itemName: string | null;
  previousValue: unknown;
  newValue: unknown;
  errorMessage: string | null;
  details: string | null;
  dryRun: boolean;
  createdAt: string;
}

export function formatJsonValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/** Single-line version for the table cells. */
export function formatCompactValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function JsonBlock({ value }: { value: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-xs">
      {value}
    </pre>
  );
}

interface SyncLogDetailDialogProps {
  log: SyncLogRow | null;
  onClose: () => void;
  onViewRun: (runId: string) => void;
}

export function SyncLogDetailDialog({
  log,
  onClose,
  onViewRun,
}: SyncLogDetailDialogProps) {
  const handleCopy = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      toast.success("Event copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const previous = formatJsonValue(log?.previousValue);
  const next = formatJsonValue(log?.newValue);

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Event details</DialogTitle>
          <DialogDescription>
            {log && new Date(log.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        {log && (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Status">
                  <div className="flex flex-wrap items-center gap-1">
                    <SyncStatusBadge status={log.status} />
                    {log.dryRun && <DryRunBadge />}
                  </div>
                </Field>
                <Field label="Trigger">
                  <SyncSourceBadge source={log.source} />
                </Field>
                <Field label="Type">
                  {SYNC_TYPE_LABELS[log.syncType] ?? log.syncType}
                </Field>
                <Field label="Platform">{log.platform}</Field>
                <Field label="Direction">{log.direction}</Field>
                <Field label="Event ID">
                  <span className="font-mono text-xs">{log.id}</span>
                </Field>
              </div>

              {log.dryRun && (
                <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-md border p-3 text-sm">
                  <FlaskConical className="text-warning mt-0.5 size-4 shrink-0" />
                  <span>
                    This was a <strong>dry run</strong> - it shows what would have happened,
                    but no change was written to Katana or Reverb.
                  </span>
                </div>
              )}

              {log.runId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-medium">
                      Part of run{" "}
                      <span className="font-mono text-xs">{log.runTrigger ?? log.runId}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      See every event this trigger produced.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewRun(log.runId as string)}
                  >
                    <ExternalLink className="mr-2 size-3.5" />
                    View run
                  </Button>
                </div>
              )}

              {log.sku && (
                <Field label="Item">
                  <span>{log.itemName}</span>
                  <p className="font-mono text-xs text-muted-foreground">{log.sku}</p>
                </Field>
              )}

              {log.details && <Field label="Details">{log.details}</Field>}

              {previous && (
                <Field label="Previous value">
                  <JsonBlock value={previous} />
                </Field>
              )}

              {next && (
                <Field label="New value">
                  <JsonBlock value={next} />
                </Field>
              )}

              {log.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Error
                  </p>
                  <p className="mt-1 break-words text-sm text-destructive">
                    {log.errorMessage}
                  </p>
                </div>
              )}

              <div>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-2 size-3.5" />
                  Copy as JSON
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
