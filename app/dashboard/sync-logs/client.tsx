"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  FlaskConical,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { Info } from "lucide-react";
import { dismissAlert } from "@/lib/integration-actions";

interface SyncLogsClientProps {
  syncLogs: any[] | null;
  alerts: any[] | null;
  error: string | null;
}

interface LogRow {
  id: string;
  syncType: string;
  platform: string;
  status: string;
  direction: string;
  sku: string | null;
  itemName: string | null;
  previousValue: string | null;
  newValue: string | null;
  errorMessage: string | null;
  details: string | null;
  dryRun: boolean;
  createdAt: string;
}

function formatValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const SYNC_TYPE_LABELS: Record<string, string> = {
  INVENTORY_QUANTITY: "Inventory Qty",
  INVENTORY_COST: "Cost Sync",
  PRODUCTION_CONSUMPTION: "Production",
  ORDER_SYNC: "Order Sync",
  SKU_MAPPING: "SKU Mapping",
  LISTING_UPDATE: "Listing Update",
};

export function SyncLogsClient({ syncLogs, alerts, error }: SyncLogsClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [syncTypeFilter, setSyncTypeFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [isDismissing, startDismiss] = useTransition();

  const logs: LogRow[] = (syncLogs ?? []).map((log: any) => ({
    id: log.id,
    syncType: log.syncType,
    platform: log.platform,
    status: log.status,
    direction: log.direction,
    sku: log.inventoryItem?.sku ?? null,
    itemName: log.inventoryItem?.name ?? null,
    previousValue: formatValue(log.previousValue),
    newValue: formatValue(log.newValue),
    errorMessage: log.errorMessage ?? null,
    details: log.details ?? null,
    dryRun: log.dryRun ?? false,
    createdAt: typeof log.createdAt === "string" ? log.createdAt : new Date(log.createdAt).toISOString(),
  }));

  const alertData = alerts ?? [];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      (log.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesSyncType = syncTypeFilter === "all" || log.syncType === syncTypeFilter;
    const matchesPlatform = platformFilter === "all" || log.platform === platformFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesSyncType && matchesPlatform && matchesStatus;
  });

  const successCount = logs.filter((l) => l.status === "SUCCESS").length;
  const failedCount = logs.filter((l) => l.status === "FAILED").length;

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh();
      toast.success("Logs refreshed");
    });
  };

  const handleDismissAlert = (alertId: string) => {
    startDismiss(async () => {
      const { error } = await dismissAlert(alertId);
      if (error) {
        toast.error("Could not dismiss alert", { description: error });
        return;
      }
      toast.success("Alert dismissed");
      router.refresh();
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge className="bg-accent/10 text-accent hover:bg-accent/20">Success</Badge>;
      case "FAILED":
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20">Failed</Badge>;
      case "PARTIAL":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Partial</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
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

  const formatSyncType = (type: string) => SYNC_TYPE_LABELS[type] || type;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Logs & Alerts</h1>
          <p className="text-muted-foreground">
            Monitor sync activity, view errors, and manage alerts
          </p>
        </div>
        <Button size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("mr-2 size-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <PageIntro icon={Info}>
        This is the audit trail for everything the system does. Each automatic or manual sync,
        every Reverb sale that decrements Katana, and any failure is recorded here so you can see
        what changed and when. Alerts flag anything that needs attention (for example an unmapped
        sale or an API error); dismiss them once handled.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2.5">
                <FileText className="text-primary size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.length}</p>
                <p className="text-xs text-muted-foreground">Recent Sync Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <CheckCircle2 className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{successCount}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2.5">
                <XCircle className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{failedCount}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-warning/10 rounded-lg p-2.5">
                <AlertTriangle className="text-warning size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alertData.length}</p>
                <p className="text-xs text-muted-foreground">Active Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Transaction Log</CardTitle>
                  <CardDescription>{filteredLogs.length} sync operations</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-48 pl-8"
                    />
                  </div>
                  <Select value={syncTypeFilter} onValueChange={setSyncTypeFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Sync Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="INVENTORY_QUANTITY">Inventory Qty</SelectItem>
                      <SelectItem value="INVENTORY_COST">Cost Sync</SelectItem>
                      <SelectItem value="ORDER_SYNC">Order Sync</SelectItem>
                      <SelectItem value="LISTING_UPDATE">Listing Update</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="KATANA">Katana</SelectItem>
                      <SelectItem value="REVERB">Reverb</SelectItem>
                      <SelectItem value="SHOPFLOW">ShopFlow</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="SUCCESS">Success</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="PARTIAL">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No sync activity yet"
                  description="Every inventory push, sale decrement and order poll is logged here. Run a sync from the Inventory Sync or Integrations page to generate entries."
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log, index) => (
                        <motion.tr
                          key={log.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "border-b transition-colors hover:bg-muted/50",
                            log.status === "FAILED" && "bg-destructive/5"
                          )}
                        >
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {formatSyncType(log.syncType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.platform}</TableCell>
                          <TableCell>
                            {log.sku ? (
                              <div>
                                <p className="font-mono text-xs">{log.sku}</p>
                                <p className="text-xs text-muted-foreground">{log.itemName}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.previousValue && log.newValue ? (
                              <span className="text-sm">
                                {log.previousValue} - {log.newValue}
                              </span>
                            ) : log.newValue ? (
                              <span className="text-sm">{log.newValue}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              {getStatusBadge(log.status)}
                              {log.dryRun && (
                                <Badge
                                  variant="outline"
                                  className="border-warning/40 bg-warning/10 text-warning gap-1"
                                >
                                  <FlaskConical className="size-3" />
                                  Dry run
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
            <CardContent className="space-y-4">
              {alertData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="mb-4 size-12 text-accent" />
                  <h3 className="text-lg font-medium">All Clear</h3>
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                alertData.map((alert: any, index: number) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "rounded-lg border p-4",
                      (alert.severity === "ERROR" || alert.severity === "CRITICAL") &&
                        "border-destructive/30 bg-destructive/5",
                      alert.severity === "WARNING" && "border-warning/30 bg-warning/5",
                      alert.severity === "INFO" && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{alert.title}</p>
                            <Badge variant="outline" className="text-xs">
                              {String(alert.type).replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                          {alert.relatedSku && (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              SKU: {alert.relatedSku}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleDismissAlert(alert.id)}
                        disabled={isDismissing}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Details</DialogTitle>
            <DialogDescription>
              {selectedLog && new Date(selectedLog.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Sync Type</p>
                  <p className="font-medium">{formatSyncType(selectedLog.syncType)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Platform</p>
                  <p className="font-medium">{selectedLog.platform}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Direction</p>
                  <p className="font-medium">{selectedLog.direction}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {getStatusBadge(selectedLog.status)}
                    {selectedLog.dryRun && (
                      <Badge
                        variant="outline"
                        className="border-warning/40 bg-warning/10 text-warning gap-1"
                      >
                        <FlaskConical className="size-3" />
                        Dry run
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {selectedLog.dryRun && (
                <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-md border p-3 text-sm">
                  <FlaskConical className="text-warning mt-0.5 size-4 shrink-0" />
                  <span>
                    This was a <strong>dry run</strong> - it shows what would have happened, but no
                    change was written to Katana or Reverb.
                  </span>
                </div>
              )}
              {selectedLog.sku && (
                <div>
                  <p className="text-sm text-muted-foreground">Item</p>
                  <p className="font-medium">{selectedLog.itemName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedLog.sku}</p>
                </div>
              )}
              {selectedLog.previousValue && (
                <div>
                  <p className="text-sm text-muted-foreground">Previous Value</p>
                  <p className="font-medium">{selectedLog.previousValue}</p>
                </div>
              )}
              {selectedLog.newValue && (
                <div>
                  <p className="text-sm text-muted-foreground">New Value</p>
                  <p className="font-medium">{selectedLog.newValue}</p>
                </div>
              )}
              {selectedLog.details && (
                <div>
                  <p className="text-sm text-muted-foreground">Details</p>
                  <p className="text-sm">{selectedLog.details}</p>
                </div>
              )}
              {selectedLog.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm text-muted-foreground">Error Message</p>
                  <p className="text-sm text-destructive">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
