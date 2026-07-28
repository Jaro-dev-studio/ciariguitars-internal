"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Bell,
  X,
  Ban,
  FilterX,
  Info,
  Loader2,
  Timer,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { dismissAlert } from "@/lib/integration-actions";
import { useQueryParams } from "@/hooks/use-query-params";
import {
  RANGE_LABELS,
  SYNC_LOG_RANGES,
  SYNC_TYPE_LABELS,
  type SyncLogFilters,
  type SyncRunFilters,
} from "@/config/sync-logs";
import {
  DryRunBadge,
  SyncSourceBadge,
  SyncStatusBadge,
} from "@/components/sync-logs/sync-status-badge";
import {
  SyncLogDetailDialog,
  formatCompactValue,
  type SyncLogRow,
} from "@/components/sync-logs/sync-log-detail-dialog";
import {
  SyncRunsTable,
  type SyncRunRow,
} from "@/components/sync-logs/sync-runs-table";
import { SyncPagination } from "@/components/sync-logs/sync-pagination";

interface LogPage {
  logs: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

interface RunPage {
  runs: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  triggers: string[];
}

interface SyncLogsClientProps {
  logPage: LogPage | null;
  runPage: RunPage | null;
  alerts: any[] | null;
  scopedRun: any | null;
  filters: SyncLogFilters;
  runFilters: SyncRunFilters;
  error: string | null;
}

export function SyncLogsClient({
  logPage,
  runPage,
  alerts,
  scopedRun,
  filters,
  runFilters,
  error,
}: SyncLogsClientProps) {
  const router = useRouter();
  const { getParam, setParams, isPending } = useQueryParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [selectedLog, setSelectedLog] = useState<SyncLogRow | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [isDismissing, startDismiss] = useTransition();

  const activeTab = getParam("tab", "logs");

  // Push the search box into the URL once typing settles, so each keystroke
  // does not fire a query against a million-row table.
  useEffect(() => {
    const current = filters.search ?? "";
    if (searchInput === current) return;

    const timeout = setTimeout(() => {
      setParams({ q: searchInput || null, page: null });
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchInput, filters.search, setParams]);

  const logs: SyncLogRow[] = (logPage?.logs ?? []).map((log: any) => ({
    id: log.id,
    syncType: log.syncType,
    platform: log.platform,
    status: log.status,
    direction: log.direction,
    source: log.source ?? "SYSTEM",
    runId: log.runId ?? null,
    runTrigger: log.run?.trigger ?? null,
    sku: log.inventoryItem?.sku ?? null,
    itemName: log.inventoryItem?.name ?? null,
    previousValue: log.previousValue ?? null,
    newValue: log.newValue ?? null,
    errorMessage: log.errorMessage ?? null,
    details: log.details ?? null,
    dryRun: log.dryRun ?? false,
    createdAt:
      typeof log.createdAt === "string"
        ? log.createdAt
        : new Date(log.createdAt).toISOString(),
  }));

  const runs: SyncRunRow[] = (runPage?.runs ?? []).map((run: any) => ({
    id: run.id,
    source: run.source,
    trigger: run.trigger,
    status: run.status,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : new Date(run.startedAt).toISOString(),
    finishedAt: run.finishedAt
      ? typeof run.finishedAt === "string"
        ? run.finishedAt
        : new Date(run.finishedAt).toISOString()
      : null,
    durationMs: run.durationMs ?? null,
    summary: (run.summary as Record<string, unknown> | null) ?? null,
    errorMessage: run.errorMessage ?? null,
    triggeredBy: run.triggeredBy ?? null,
    logCount: run._count?.logs ?? 0,
  }));

  const alertData = alerts ?? [];
  const statusCounts = logPage?.statusCounts ?? {};
  const totalEvents = logPage?.total ?? 0;

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.runId) ||
    filters.syncType !== "all" ||
    filters.platform !== "all" ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.dryRun !== "all";

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
      toast.success("Refreshed");
    });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setParams({
      q: null,
      type: null,
      platform: null,
      status: null,
      source: null,
      dryRun: null,
      runId: null,
      page: null,
    });
  };

  const handleViewRun = (runId: string) => {
    setSelectedLog(null);
    setParams({ runId, tab: "logs", page: null });
  };

  const handleDismissAlert = (alertId: string) => {
    startDismiss(async () => {
      const { error: dismissError } = await dismissAlert(alertId);
      if (dismissError) {
        toast.error("Could not dismiss alert", { description: dismissError });
        return;
      }
      toast.success("Alert dismissed");
      router.refresh();
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "ERROR":
      case "CRITICAL":
        return <XCircle className="size-4 text-destructive" />;
      case "WARNING":
        return <AlertTriangle className="text-warning size-4" />;
      default:
        return <Bell className="text-primary size-4" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Events</h1>
          <p className="text-muted-foreground">
            Debug every cron run, webhook delivery and manual sync
          </p>
        </div>
        <Button size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("mr-2 size-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <PageIntro icon={Info}>
        This is the audit trail for everything the system does. The{" "}
        <strong>Runs</strong> tab lists each time a cron, webhook or manual action fired,
        with how long it took and what it produced. The <strong>Events</strong> tab is the
        line-by-line detail underneath those runs. Open a run to see only its events.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          iconClass="bg-primary/10 text-primary"
          value={totalEvents}
          label="Matching events"
        />
        <StatCard
          icon={CheckCircle2}
          iconClass="bg-accent/10 text-accent"
          value={statusCounts.SUCCESS ?? 0}
          label="Successful"
        />
        <StatCard
          icon={XCircle}
          iconClass="bg-destructive/10 text-destructive"
          value={statusCounts.FAILED ?? 0}
          label="Failed"
        />
        <StatCard
          icon={Ban}
          iconClass="bg-muted text-muted-foreground"
          value={statusCounts.SKIPPED ?? 0}
          label="Skipped (no change needed)"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setParams({ tab: value === "logs" ? null : value })}
        className="flex flex-col gap-4"
      >
        <TabsList>
          <TabsTrigger value="logs">Events</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            Alerts
            {alertData.length > 0 && (
              <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {alertData.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    Events
                    {isPending && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {totalEvents.toLocaleString()} events match the current filters
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-56 flex-1">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search SKU, order number, details, error..."
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <FilterSelect
                    value={filters.range ?? "7d"}
                    onChange={(value) => setParams({ range: value, page: null })}
                    className="w-36"
                    options={SYNC_LOG_RANGES.map((range) => ({
                      value: range,
                      label: RANGE_LABELS[range],
                    }))}
                  />
                  <FilterSelect
                    value={filters.source ?? "all"}
                    onChange={(value) => setParams({ source: value, page: null })}
                    className="w-32"
                    options={[
                      { value: "all", label: "All triggers" },
                      { value: "CRON", label: "Cron" },
                      { value: "WEBHOOK", label: "Webhook" },
                      { value: "MANUAL", label: "Manual" },
                      { value: "SYSTEM", label: "System" },
                    ]}
                  />
                  <FilterSelect
                    value={filters.syncType ?? "all"}
                    onChange={(value) => setParams({ type: value, page: null })}
                    className="w-36"
                    options={[
                      { value: "all", label: "All types" },
                      ...Object.entries(SYNC_TYPE_LABELS).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                  <FilterSelect
                    value={filters.platform ?? "all"}
                    onChange={(value) => setParams({ platform: value, page: null })}
                    className="w-32"
                    options={[
                      { value: "all", label: "All platforms" },
                      { value: "KATANA", label: "Katana" },
                      { value: "REVERB", label: "Reverb" },
                      { value: "SHOPFLOW", label: "ShopFlow" },
                    ]}
                  />
                  <FilterSelect
                    value={filters.status ?? "all"}
                    onChange={(value) => setParams({ status: value, page: null })}
                    className="w-32"
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "SUCCESS", label: "Success" },
                      { value: "FAILED", label: "Failed" },
                      { value: "SKIPPED", label: "Skipped" },
                      { value: "PARTIAL", label: "Partial" },
                      { value: "PENDING", label: "Pending" },
                    ]}
                  />
                  <FilterSelect
                    value={filters.dryRun ?? "all"}
                    onChange={(value) => setParams({ dryRun: value, page: null })}
                    className="w-32"
                    options={[
                      { value: "all", label: "Live + dry run" },
                      { value: "true", label: "Dry run only" },
                      { value: "false", label: "Live only" },
                    ]}
                  />

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      <FilterX className="mr-2 size-4" />
                      Clear
                    </Button>
                  )}
                </div>

                {scopedRun && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <SyncSourceBadge source={scopedRun.source} />
                      <span>
                        Showing events from{" "}
                        <span className="font-mono text-xs font-medium">
                          {scopedRun.trigger}
                        </span>{" "}
                        on {new Date(scopedRun.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParams({ runId: null, page: null })}
                    >
                      <X className="mr-2 size-3.5" />
                      Show all events
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {logs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No events match these filters"
                  description="Try widening the time range or clearing the filters. Events older than the selected window are excluded."
                />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow
                          key={log.id}
                          className={cn(
                            "cursor-pointer",
                            log.status === "FAILED" && "bg-destructive/5"
                          )}
                          onClick={() => setSelectedLog(log)}
                        >
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <SyncSourceBadge source={log.source} />
                              {log.runTrigger && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {log.runTrigger}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {SYNC_TYPE_LABELS[log.syncType] ?? log.syncType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.platform}</TableCell>
                          <TableCell>
                            {log.sku ? (
                              <div>
                                <p className="font-mono text-xs">{log.sku}</p>
                                <p className="text-xs text-muted-foreground">
                                  {log.itemName}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {log.details ??
                                formatCompactValue(log.newValue) ??
                                "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <SyncStatusBadge status={log.status} />
                              {log.dryRun && <DryRunBadge />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedLog(log);
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

              {logPage && logPage.total > 0 && (
                <SyncPagination
                  page={logPage.page}
                  totalPages={logPage.totalPages}
                  total={logPage.total}
                  pageSize={logPage.pageSize}
                  itemLabel="events"
                  isPending={isPending}
                  onPageChange={(page) => setParams({ page })}
                  onPageSizeChange={(pageSize) => setParams({ pageSize, page: null })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    Runs
                    {isPending && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    Each cron execution, webhook delivery and manual action, newest first
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <FilterSelect
                    value={runFilters.range ?? "7d"}
                    onChange={(value) => setParams({ range: value, runPage: null })}
                    className="w-36"
                    options={SYNC_LOG_RANGES.map((range) => ({
                      value: range,
                      label: RANGE_LABELS[range],
                    }))}
                  />
                  <FilterSelect
                    value={runFilters.source ?? "all"}
                    onChange={(value) => setParams({ runSource: value, runPage: null })}
                    className="w-32"
                    options={[
                      { value: "all", label: "All triggers" },
                      { value: "CRON", label: "Cron" },
                      { value: "WEBHOOK", label: "Webhook" },
                      { value: "MANUAL", label: "Manual" },
                    ]}
                  />
                  <FilterSelect
                    value={runFilters.trigger ?? "all"}
                    onChange={(value) => setParams({ trigger: value, runPage: null })}
                    className="w-48"
                    options={[
                      { value: "all", label: "All jobs" },
                      ...(runPage?.triggers ?? []).map((trigger) => ({
                        value: trigger,
                        label: trigger,
                      })),
                    ]}
                  />
                  <FilterSelect
                    value={runFilters.status ?? "all"}
                    onChange={(value) => setParams({ runStatus: value, runPage: null })}
                    className="w-32"
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "SUCCESS", label: "Success" },
                      { value: "FAILED", label: "Failed" },
                      { value: "RUNNING", label: "Running" },
                    ]}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <SyncRunsTable runs={runs} onViewEvents={handleViewRun} />

              {runPage && runPage.total > 0 && (
                <SyncPagination
                  page={runPage.page}
                  totalPages={runPage.totalPages}
                  total={runPage.total}
                  pageSize={runPage.pageSize}
                  itemLabel="runs"
                  isPending={isPending}
                  onPageChange={(page) => setParams({ runPage: page })}
                  onPageSizeChange={(pageSize) =>
                    setParams({ pageSize, runPage: null, page: null })
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Alerts</CardTitle>
              <CardDescription>Issues requiring attention or review</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {alertData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="mb-4 size-12 text-accent" />
                  <h3 className="text-lg font-medium">All Clear</h3>
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                alertData.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-lg border p-4",
                      (alert.severity === "ERROR" || alert.severity === "CRITICAL") &&
                        "border-destructive/30 bg-destructive/5",
                      alert.severity === "WARNING" && "border-warning/30 bg-warning/5",
                      alert.severity === "INFO" && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{alert.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {String(alert.type).replace(/_/g, " ")}
                            </Badge>
                            {alert.count > 1 && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Timer className="size-3" />
                                {alert.count.toLocaleString()} occurrences
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {alert.message}
                          </p>
                          {alert.relatedSku && (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              SKU: {alert.relatedSku}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            First seen {new Date(alert.createdAt).toLocaleString()}
                            {alert.count > 1 &&
                              ` - last seen ${new Date(alert.updatedAt).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => handleDismissAlert(alert.id)}
                        disabled={isDismissing}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SyncLogDetailDialog
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onViewRun={handleViewRun}
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
  icon: typeof FileText;
  iconClass: string;
  value: number;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", iconClass)}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
