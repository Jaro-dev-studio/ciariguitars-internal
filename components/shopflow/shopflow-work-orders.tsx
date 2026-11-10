"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LiveSwitchBanner } from "@/components/integrations/live-switch-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatTimeAgo } from "@/lib/utils";
import {
  reprocessShopFlowWorkOrder,
  setShopFlowBookingsLiveNow,
  upsertShopFlowPartMapping,
} from "@/lib/shopflow-actions";
import type { ShopFlowBookingsState } from "@/lib/shopflow/bookings-switch";

export interface ShopFlowWorkOrderRow {
  invoiceId: string;
  instrumentType: string;
  instrumentName: string | null;
  serialNumber: string | null;
  model: string | null;
  finish: string | null;
  orientation: string | null;
  resolvedSku: string | null;
  status: string;
  blockedReason: string | null;
  deliveryCount: number;
  stockAdjustmentId: string | null;
  lastSeenAt: string;
  partsResolved: number;
  partsUnresolved: number;
  finishedGoodDetail: string | null;
  notBookedReason: string | null;
}

export interface UnmappedPartRow {
  partId: string;
  partName: string | null;
  count: number;
}

export interface UnconfirmedPartRow extends UnmappedPartRow {
  /** The Katana SKU it was loosely matched to. */
  katanaSku: string;
}

interface ShopFlowWorkOrdersProps {
  workOrders: ShopFlowWorkOrderRow[];
  statusCounts: Record<string, number>;
  unmappedParts: UnmappedPartRow[];
  unconfirmedParts: UnconfirmedPartRow[];
  bookings: ShopFlowBookingsState;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  BOOKED: {
    label: "Booked",
    className: "border-transparent bg-emerald-500/10 text-emerald-600",
  },
  RESOLVED: {
    label: "Ready to book",
    className: "border-transparent bg-blue-500/10 text-blue-600",
  },
  REPAIR: {
    label: "Repair",
    className: "border-transparent bg-violet-500/10 text-violet-600",
  },
  NEEDS_MAPPING: {
    label: "Needs mapping",
    className: "border-transparent bg-amber-500/10 text-amber-600",
  },
  BLOCKED: {
    label: "Blocked",
    className: "border-transparent bg-destructive/10 text-destructive",
  },
  RECEIVED: {
    label: "Received",
    className: "border-transparent bg-muted text-muted-foreground",
  },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.RECEIVED;
  return (
    <Badge variant="outline" className={cn("font-medium", style.className)}>
      {style.label}
    </Badge>
  );
}

export function ShopFlowWorkOrders({
  workOrders,
  statusCounts,
  unmappedParts,
  unconfirmedParts,
  bookings,
}: ShopFlowWorkOrdersProps) {
  const router = useRouter();
  const [pendingInvoice, setPendingInvoice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsMapping = statusCounts.NEEDS_MAPPING ?? 0;
  const booked = statusCounts.BOOKED ?? 0;
  const repairs = statusCounts.REPAIR ?? 0;

  const handleReprocess = (invoiceId: string) => {
    setPendingInvoice(invoiceId);
    startTransition(async () => {
      const { data, error } = await reprocessShopFlowWorkOrder(invoiceId);
      setPendingInvoice(null);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(
        data?.unresolved
          ? `Reprocessed - ${data.unresolved} part(s) still unmapped`
          : "Reprocessed successfully"
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <LiveSwitchBanner
        id="shopflow-bookings-switch"
        label="Shop Flow bookings"
        state={bookings}
        live={{
          title: "Live - completed Shop Flow work orders are booked into Katana automatically.",
          body: "Builds take their parts out of Katana and add the finished guitar; repairs take their parts out. Finished guitars no longer need adding to Katana by hand.",
        }}
        off={{
          title: "Dry run - Shop Flow bookings are off, so nothing is written to Katana.",
          body: "Work orders are still received and checked below. Finished guitars still need adding to Katana by hand.",
        }}
        confirmOn={{
          title: "Switch Shop Flow bookings on?",
          body: "Work orders received from now on will be booked into Katana once every part is mapped: builds take their parts out and add the finished guitar, repairs take their parts out. Work orders received before now are never booked, so stop adding finished guitars to Katana by hand from now on.",
        }}
        confirmOff={{
          title: "Switch Shop Flow bookings off?",
          body: "Nothing will be written to Katana until it is switched back on, and work orders received in the meantime will never be booked automatically. Add finished guitars to Katana by hand until then.",
        }}
        onSwitch={setShopFlowBookingsLiveNow}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<CheckCircle2 className="text-emerald-600 size-4" />}
          label="Booked to Katana"
          value={booked}
        />
        <SummaryCard
          icon={<AlertTriangle className="text-amber-600 size-4" />}
          label="Waiting on part mappings"
          value={needsMapping}
        />
        <SummaryCard
          icon={<Wrench className="text-violet-600 size-4" />}
          label="Repairs (no stock added)"
          value={repairs}
        />
      </div>

      {unmappedParts.length > 0 && (
        <UnmappedPartsCard parts={unmappedParts} />
      )}

      {unconfirmedParts.length > 0 && (
        <UnconfirmedPartsCard parts={unconfirmedParts} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Work orders</CardTitle>
          <CardDescription>
            One row per Shop Flow invoice. A work order can be reopened and
            completed again, so repeat deliveries are applied as revisions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {workOrders.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No work orders processed yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Parts</TableHead>
                    <TableHead>Finished good</TableHead>
                    <TableHead className="text-right">Seen</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((order) => (
                    <TableRow key={order.invoiceId}>
                      <TableCell className="align-top">
                        <div className="font-medium">{order.invoiceId}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.instrumentType}
                          {order.deliveryCount > 1
                            ? ` - ${order.deliveryCount} deliveries`
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div>{order.instrumentName ?? order.model ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {[order.serialNumber, order.finish, order.orientation]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge status={order.status} />
                        {order.blockedReason && (
                          <div className="mt-1 max-w-64 text-xs text-muted-foreground">
                            {order.blockedReason}
                          </div>
                        )}
                        {order.notBookedReason && (
                          <div className="mt-1 max-w-64 text-xs text-muted-foreground">
                            Not booked: {order.notBookedReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        <div>{order.partsResolved} resolved</div>
                        {order.partsUnresolved > 0 && (
                          <div className="text-amber-600 text-xs">
                            {order.partsUnresolved} unmapped
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {order.resolvedSku ? (
                          <span className="font-mono text-xs">
                            {order.resolvedSku}
                          </span>
                        ) : (
                          <span className="flex items-start gap-1 text-xs text-muted-foreground">
                            <Ban className="mt-0.5 size-3 shrink-0" />
                            {order.finishedGoodDetail ?? "Not resolved"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top text-xs text-muted-foreground">
                        {formatTimeAgo(order.lastSeenAt)}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending && pendingInvoice === order.invoiceId}
                          onClick={() => handleReprocess(order.invoiceId)}
                        >
                          {isPending && pendingInvoice === order.invoiceId ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Reprocess"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        {icon}
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function UnmappedPartsCard({ parts }: { parts: UnmappedPartRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts needing a Katana mapping</CardTitle>
        <CardDescription>
          These Shop Flow part numbers have no Katana match. Map each to a SKU,
          or ignore it if it is packaging or tooling that Katana does not stock.
          Work orders stay unbooked until every part resolves.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {parts.map((part) => (
          <UnmappedPartRowForm key={part.partId} part={part} />
        ))}
      </CardContent>
    </Card>
  );
}

function UnconfirmedPartsCard({ parts }: { parts: UnconfirmedPartRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts to confirm</CardTitle>
        <CardDescription>
          These Shop Flow part numbers only matched a Katana SKU with a
          different revision. Confirm the SKU if it is the right part, or enter
          the correct one. Work orders stay unbooked until every part is
          confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {parts.map((part) => (
          <UnmappedPartRowForm
            key={part.partId}
            part={part}
            suggestedSku={part.katanaSku}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function UnmappedPartRowForm({
  part,
  suggestedSku,
}: {
  part: UnmappedPartRow;
  /** Loosely matched SKU to confirm, prefilled. */
  suggestedSku?: string;
}) {
  const router = useRouter();
  const [sku, setSku] = useState(suggestedSku ?? "");
  const [isPending, startTransition] = useTransition();

  const save = (isIgnored: boolean) => {
    startTransition(async () => {
      const { error } = await upsertShopFlowPartMapping({
        shopflowPartId: part.partId,
        partName: part.partName,
        katanaSku: isIgnored ? null : sku,
        isIgnored,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(
        isIgnored ? `${part.partId} will be ignored` : `${part.partId} mapped`
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="break-words font-mono text-sm">{part.partId}</div>
        <div className="break-words text-xs text-muted-foreground">
          {part.partName ?? "No description"} - in {part.count} work order
          {part.count === 1 ? "" : "s"}
          {suggestedSku ? ` - matched to ${suggestedSku}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="Katana SKU"
          className="h-9 w-full sm:w-48"
          disabled={isPending}
        />
        <Button
          size="sm"
          onClick={() => save(false)}
          disabled={isPending || !sku.trim()}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : suggestedSku ? (
            "Confirm"
          ) : (
            "Map"
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => save(true)}
          disabled={isPending}
        >
          Ignore
        </Button>
      </div>
    </div>
  );
}
