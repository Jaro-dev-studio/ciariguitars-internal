"use client";

import { Copy, ExternalLink } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncStatusBadge } from "@/components/sync-logs/sync-status-badge";
import {
  formatPayloadJson,
  summariseShopFlowPayload,
} from "@/lib/shopflow-payload";

export interface ShopFlowEventRow {
  id: string;
  status: string;
  details: string | null;
  errorMessage: string | null;
  payload: unknown;
  createdAt: string;
  runId: string | null;
  runTrigger: string | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

interface ShopFlowEventDetailDialogProps {
  event: ShopFlowEventRow | null;
  onClose: () => void;
  onViewRun: (runId: string) => void;
}

export function ShopFlowEventDetailDialog({
  event,
  onClose,
  onViewRun,
}: ShopFlowEventDetailDialogProps) {
  const summary = event ? summariseShopFlowPayload(event.payload) : null;
  const json = event ? formatPayloadJson(event.payload) : "";

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shop Flow delivery</DialogTitle>
          <DialogDescription>
            {event && `Received ${new Date(event.createdAt).toLocaleString()}`}
          </DialogDescription>
        </DialogHeader>

        {event && summary && (
          <ScrollArea className="max-h-[62vh] pr-4">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Status">
                  <SyncStatusBadge status={event.status} />
                </Field>
                <Field label="Event">
                  {event.runTrigger ? (
                    <span className="font-mono text-xs">{event.runTrigger}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </Field>
                <Field label="Event ID">
                  <span className="font-mono text-xs">{event.id}</span>
                </Field>
              </div>

              {event.details && <Field label="Summary">{event.details}</Field>}

              {event.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Error
                  </p>
                  <p className="mt-1 break-words text-sm text-destructive">
                    {event.errorMessage}
                  </p>
                </div>
              )}

              <Tabs defaultValue="fields" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TabsList>
                    <TabsTrigger value="fields">
                      Fields
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {summary.fields.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="json">Raw JSON</TabsTrigger>
                  </TabsList>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(json, "Payload")}
                  >
                    <Copy className="mr-2 size-3.5" />
                    Copy payload
                  </Button>
                </div>

                <TabsContent value="fields">
                  {summary.isEmpty ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Shop Flow posted an empty body. Nothing to break down.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-sm">
                        <tbody>
                          {summary.fields.map((field) => (
                            <tr
                              key={field.path}
                              className="border-b align-top last:border-b-0"
                            >
                              <td className="w-1/2 break-words bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                                {field.path}
                              </td>
                              <td className="break-words px-3 py-2 text-xs">
                                {field.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="json">
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                    {json || "(empty body)"}
                  </pre>
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(event.id, "Event ID")}
                >
                  <Copy className="mr-2 size-3.5" />
                  Copy event ID
                </Button>
                {event.runId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewRun(event.runId as string)}
                  >
                    <ExternalLink className="mr-2 size-3.5" />
                    View in sync logs
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
