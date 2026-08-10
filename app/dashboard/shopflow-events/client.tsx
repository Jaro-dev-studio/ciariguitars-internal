"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FilterX,
  Inbox,
  Info,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { useQueryParams } from "@/hooks/use-query-params";
import { RANGE_LABELS, SYNC_LOG_RANGES } from "@/config/sync-logs";
import {
  DEFAULT_SHOPFLOW_RANGE,
  type ShopFlowEventFilters,
} from "@/config/shopflow-events";
import { SyncStatusBadge } from "@/components/sync-logs/sync-status-badge";
import { SyncPagination } from "@/components/sync-logs/sync-pagination";
import {
  ShopFlowEventDetailDialog,
  type ShopFlowEventRow,
} from "@/components/shopflow/shopflow-event-detail-dialog";
import { compactPayload, summariseShopFlowPayload } from "@/lib/shopflow-payload";

interface ShopFlowEventsClientProps {
  events: ShopFlowEventRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  allTimeTotal: number;
  last24hTotal: number;
  lastReceivedAt: string | null;
  endpointUrl: string;
  filters: ShopFlowEventFilters;
  error: string | null;
}

export function ShopFlowEventsClient({
  events,
  total,
  currentPage,
  pageSize,
  totalPages,
  statusCounts,
  allTimeTotal,
  last24hTotal,
  lastReceivedAt,
  endpointUrl,
  filters,
  error,
}: ShopFlowEventsClientProps) {
  const router = useRouter();
  const { setParams, isPending } = useQueryParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [selectedEvent, setSelectedEvent] = useState<ShopFlowEventRow | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  // Push the search box into the URL once typing settles rather than querying
  // on every keystroke.
  useEffect(() => {
    const current = filters.search ?? "";
    if (searchInput === current) return;

    const timeout = setTimeout(() => {
      setParams({ q: searchInput || null, page: null });
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchInput, filters.search, setParams]);

  const rows = useMemo(
    () =>
      events.map((event) => ({
        event,
        summary: summariseShopFlowPayload(event.payload),
      })),
    [events]
  );

  const hasActiveFilters =
    Boolean(filters.search) ||
    (filters.status ?? "all") !== "all" ||
    (filters.range ?? DEFAULT_SHOPFLOW_RANGE) !== DEFAULT_SHOPFLOW_RANGE;

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
      toast.success("Refreshed");
    });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setParams({ q: null, status: null, range: null, page: null });
  };

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl);
      toast.success("Endpoint URL copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shop Flow Events</h1>
          <p className="text-muted-foreground">
            Everything Shop Flow has posted to the webhook, newest first
          </p>
        </div>
        <Button size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("mr-2 size-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <PageIntro icon={Info}>
        The webhook accepts any JSON shape and stores it verbatim, so you can see
        exactly what Shop Flow sends while the integration is being specced out.
        Nothing here writes to Katana or Reverb.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Endpoint
            </p>
            <p className="truncate font-mono text-sm">
              <span className="mr-2 font-sans font-medium">POST</span>
              {endpointUrl}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleCopyEndpoint}
          >
            <Copy className="mr-2 size-3.5" />
            Copy URL
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Inbox}
          iconClass="bg-primary/10 text-primary"
          value={allTimeTotal.toLocaleString()}
          label="Received all time"
        />
        <StatCard
          icon={CheckCircle2}
          iconClass="bg-accent/10 text-accent"
          value={last24hTotal.toLocaleString()}
          label="Received in last 24 hours"
        />
        <StatCard
          icon={XCircle}
          iconClass="bg-destructive/10 text-destructive"
          value={(statusCounts.FAILED ?? 0).toLocaleString()}
          label="Failed to capture"
        />
        <StatCard
          icon={Clock}
          iconClass="bg-muted text-muted-foreground"
          value={lastReceivedAt ? formatTimeAgo(lastReceivedAt) : "Never"}
          label="Last delivery"
        />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                Deliveries
                {isPending && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <CardDescription>
                {total.toLocaleString()} deliveries match the current filters
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search serial, SKU, order number..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="pl-8"
                />
              </div>

              <Select
                value={filters.range ?? DEFAULT_SHOPFLOW_RANGE}
                onValueChange={(value) => setParams({ range: value, page: null })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_LOG_RANGES.map((range) => (
                    <SelectItem key={range} value={range}>
                      {RANGE_LABELS[range]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status ?? "all"}
                onValueChange={(value) => setParams({ status: value, page: null })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="SUCCESS">Captured</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  <FilterX className="mr-2 size-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={
                allTimeTotal === 0
                  ? "No deliveries yet"
                  : "No deliveries match these filters"
              }
              description={
                allTimeTotal === 0
                  ? "Point Shop Flow at the endpoint above. Every payload it posts will show up here, whatever shape it is in."
                  : "Try widening the time range or clearing the filters."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Received</TableHead>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Payload</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ event, summary }) => (
                    <TableRow
                      key={event.id}
                      className={cn(
                        "cursor-pointer",
                        event.status === "FAILED" && "bg-destructive/5"
                      )}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        <p>{new Date(event.createdAt).toLocaleString()}</p>
                        <p className="text-xs">{formatTimeAgo(event.createdAt)}</p>
                      </TableCell>
                      <TableCell className="max-w-56">
                        {summary.primary ? (
                          <div className="flex flex-col gap-0.5">
                            <p className="truncate font-mono text-xs font-medium">
                              {summary.primary.value}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {summary.highlights
                                .slice(1, 3)
                                .map((highlight) => `${highlight.label}: ${highlight.value}`)
                                .join(" - ") || summary.primary.label}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit text-xs">
                            {summary.fields.length} field
                            {summary.fields.length === 1 ? "" : "s"}
                          </Badge>
                          <span className="line-clamp-2 font-mono text-xs text-muted-foreground">
                            {compactPayload(event.payload)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <SyncStatusBadge status={event.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setSelectedEvent(event);
                          }}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {total > 0 && (
            <SyncPagination
              page={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              itemLabel="deliveries"
              isPending={isPending}
              onPageChange={(page) => setParams({ page })}
              onPageSizeChange={(size) => setParams({ pageSize: size, page: null })}
            />
          )}
        </CardContent>
      </Card>

      <ShopFlowEventDetailDialog
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onViewRun={(runId) => router.push(`/dashboard/sync-logs?runId=${runId}`)}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  value,
  label,
}: {
  icon: typeof Inbox;
  iconClass: string;
  value: string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", iconClass)}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
