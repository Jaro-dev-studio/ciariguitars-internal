"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  Eye,
  RotateCcw,
  Trash2,
  Bell,
  X,
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
  DialogFooter,
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

interface SyncLog {
  id: string;
  syncType: string;
  platform: string;
  status: string;
  direction: string;
  inventoryItem: { sku: string; name: string } | null;
  previousValue: any;
  newValue: any;
  errorMessage: string | null;
  details: string | null;
  createdAt: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  relatedSku: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface SyncLogsClientProps {
  syncLogs: any[] | null;
  alerts: any[] | null;
  error: string | null;
}

interface MockLog {
  id: string;
  syncType: string;
  platform: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL" | "PENDING";
  direction: "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";
  sku: string | null;
  itemName: string | null;
  previousValue: string | null;
  newValue: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const mockLogs: MockLog[] = [
  { id: "1", syncType: "INVENTORY_QUANTITY", platform: "KATANA", status: "SUCCESS", direction: "OUTBOUND", sku: "CG-TELE-001", itemName: "Classic Telecaster", previousValue: "4", newValue: "5", errorMessage: null, createdAt: "2024-01-15T10:30:00Z" },
  { id: "2", syncType: "INVENTORY_QUANTITY", platform: "REVERB", status: "SUCCESS", direction: "OUTBOUND", sku: "CG-TELE-001", itemName: "Classic Telecaster", previousValue: "4", newValue: "5", errorMessage: null, createdAt: "2024-01-15T10:31:00Z" },
  { id: "3", syncType: "INVENTORY_COST", platform: "SHOPFLOW", status: "SUCCESS", direction: "OUTBOUND", sku: "CG-STRAT-002", itemName: "Modern Stratocaster", previousValue: "$780.00", newValue: "$845.00", errorMessage: null, createdAt: "2024-01-15T10:30:00Z" },
  { id: "4", syncType: "INVENTORY_QUANTITY", platform: "SHOPIFY", status: "FAILED", direction: "OUTBOUND", sku: "CG-LP-003", itemName: "Les Paul Custom", previousValue: "2", newValue: null, errorMessage: "API rate limit exceeded. Retry in 60 seconds.", createdAt: "2024-01-15T10:29:00Z" },
  { id: "5", syncType: "PRODUCTION_CONSUMPTION", platform: "KATANA", status: "SUCCESS", direction: "OUTBOUND", sku: "RAW-WOOD-ASH", itemName: "Swamp Ash Body Blank", previousValue: "10", newValue: "8", errorMessage: null, createdAt: "2024-01-15T10:15:00Z" },
  { id: "6", syncType: "ORDER_SYNC", platform: "REVERB", status: "SUCCESS", direction: "INBOUND", sku: null, itemName: null, previousValue: null, newValue: "Order #RV-12345", errorMessage: null, createdAt: "2024-01-15T10:00:00Z" },
  { id: "7", syncType: "LISTING_UPDATE", platform: "REVERB", status: "PARTIAL", direction: "OUTBOUND", sku: "CG-335-004", itemName: "Semi-Hollow 335", previousValue: "Qty: 2, Price: $2899", newValue: "Qty: 1 (price unchanged)", errorMessage: "Price update skipped - preserve price enabled", createdAt: "2024-01-15T09:45:00Z" },
  { id: "8", syncType: "INVENTORY_QUANTITY", platform: "KATANA", status: "SUCCESS", direction: "OUTBOUND", sku: "CG-JAZZ-005", itemName: "Jazz Bass", previousValue: "3", newValue: "4", errorMessage: null, createdAt: "2024-01-15T09:30:00Z" },
  { id: "9", syncType: "SKU_MAPPING", platform: "SHOPIFY", status: "SUCCESS", direction: "BIDIRECTIONAL", sku: "CG-PRS-006", itemName: "PRS Style", previousValue: null, newValue: "Mapped to SH-PRS-AF", errorMessage: null, createdAt: "2024-01-15T09:00:00Z" },
  { id: "10", syncType: "INVENTORY_QUANTITY", platform: "REVERB", status: "FAILED", direction: "OUTBOUND", sku: "CG-TELE-002", itemName: "Telecaster Deluxe", previousValue: "1", newValue: null, errorMessage: "Listing not found on Reverb. SKU may have been removed.", createdAt: "2024-01-15T08:30:00Z" },
];

interface MockAlert {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  title: string;
  message: string;
  relatedSku: string | null;
  isRead: boolean;
  createdAt: string;
}

const mockAlerts: MockAlert[] = [
  { id: "1", type: "SYNC_FAILURE", severity: "ERROR", title: "Shopify Sync Failed", message: "API rate limit exceeded when syncing CG-LP-003. Will retry automatically.", relatedSku: "CG-LP-003", isRead: false, createdAt: "2024-01-15T10:29:00Z" },
  { id: "2", type: "QUANTITY_MISMATCH", severity: "WARNING", title: "Quantity Mismatch Detected", message: "CG-STRAT-002 shows different quantities: Katana (3), Shopify (2). Manual review recommended.", relatedSku: "CG-STRAT-002", isRead: false, createdAt: "2024-01-15T10:00:00Z" },
  { id: "3", type: "LOW_STOCK", severity: "WARNING", title: "Low Stock Alert", message: "Nitrocellulose Lacquer (RAW-NCL-001) is below reorder point. Current qty: 3, Reorder at: 5.", relatedSku: "RAW-NCL-001", isRead: true, createdAt: "2024-01-15T09:00:00Z" },
  { id: "4", type: "CONNECTION_ERROR", severity: "INFO", title: "ManageMarkets Disconnected", message: "ManageMarkets integration is not connected. Connect to enable international shipping features.", relatedSku: null, isRead: true, createdAt: "2024-01-14T12:00:00Z" },
];

export function SyncLogsClient({ syncLogs, alerts, error }: SyncLogsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [syncTypeFilter, setSyncTypeFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<MockLog | null>(null);

  const logs = mockLogs;
  const alertData = mockAlerts;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (log.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesSyncType = syncTypeFilter === "all" || log.syncType === syncTypeFilter;
    const matchesPlatform = platformFilter === "all" || log.platform === platformFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;

    return (searchTerm === "" || matchesSearch) && matchesSyncType && matchesPlatform && matchesStatus;
  });

  const unreadAlerts = alertData.filter(a => !a.isRead);
  const successCount = logs.filter(l => l.status === "SUCCESS").length;
  const failedCount = logs.filter(l => l.status === "FAILED").length;

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
        return <AlertTriangle className="size-4 text-warning" />;
      default:
        return <Bell className="size-4 text-primary" />;
    }
  };

  const handleRetry = (logId: string) => {
    toast.success("Sync retry queued", {
      description: "The sync will be retried shortly",
    });
  };

  const handleDismissAlert = (alertId: string) => {
    toast.success("Alert dismissed");
  };

  const formatSyncType = (type: string) => {
    const map: Record<string, string> = {
      INVENTORY_QUANTITY: "Inventory Qty",
      INVENTORY_COST: "Cost Sync",
      PRODUCTION_CONSUMPTION: "Production",
      ORDER_SYNC: "Order Sync",
      SKU_MAPPING: "SKU Mapping",
      LISTING_UPDATE: "Listing Update",
    };
    return map[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Logs & Alerts</h1>
          <p className="text-muted-foreground">
            Monitor sync activity, view errors, and manage alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 size-4" />
            Export Logs
          </Button>
          <Button size="sm">
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <FileText className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.length}</p>
                <p className="text-xs text-muted-foreground">Total Syncs Today</p>
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
              <div className="rounded-lg bg-warning/10 p-2.5">
                <AlertTriangle className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadAlerts.length}</p>
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
            {unreadAlerts.length > 0 && (
              <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {unreadAlerts.length}
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
                      <SelectItem value="PRODUCTION_CONSUMPTION">Production</SelectItem>
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
                      <SelectItem value="SHOPIFY">Shopify</SelectItem>
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
                      <TableHead className="w-20">Actions</TableHead>
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
                          {new Date(log.createdAt).toLocaleTimeString()}
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
                              {log.previousValue} → {log.newValue}
                            </span>
                          ) : log.newValue ? (
                            <span className="text-sm">{log.newValue}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-8"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            {log.status === "FAILED" && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8"
                                onClick={() => handleRetry(log.id)}
                              >
                                <RotateCcw className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Alerts</CardTitle>
              <CardDescription>
                Issues requiring attention or review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alertData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="mb-4 size-12 text-accent" />
                  <h3 className="text-lg font-medium">All Clear</h3>
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                alertData.map((alert, index) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "rounded-lg border p-4",
                      alert.severity === "ERROR" && "border-destructive/30 bg-destructive/5",
                      alert.severity === "WARNING" && "border-warning/30 bg-warning/5",
                      alert.severity === "INFO" && "border-primary/30 bg-primary/5",
                      alert.isRead && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{alert.title}</p>
                            <Badge variant="outline" className="text-xs">{alert.type.replace("_", " ")}</Badge>
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
                  {getStatusBadge(selectedLog.status)}
                </div>
              </div>
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
              {selectedLog.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm text-muted-foreground">Error Message</p>
                  <p className="text-sm text-destructive">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedLog?.status === "FAILED" && (
              <Button onClick={() => handleRetry(selectedLog.id)}>
                <RotateCcw className="mr-2 size-4" />
                Retry Sync
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
