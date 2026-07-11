"use client";

import { motion } from "framer-motion";
import {
  RefreshCw,
  Package,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/page-intro";

interface DashboardData {
  integrationStatus: {
    platform: string;
    status: "connected" | "disconnected" | "error";
    lastSync: string | null;
  }[];
  metrics: {
    totalSkus: number;
    syncedToday: number;
    pendingSync: number;
    errorCount: number;
  };
  recentSyncs: {
    id: string;
    type: string;
    platform: string;
    status: string;
    createdAt: string;
    itemCount: number;
  }[];
  alerts: {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    createdAt: string;
  }[];
  inventoryOverview: {
    finishedGoods: number;
    rawMaterials: number;
    lowStock: number;
    readyToShip: number;
  };
  productionStats: {
    activeOrders: number;
    completedToday: number;
    onHold: number;
  };
}

interface DashboardClientProps {
  initialData: any | null;
  error: string | null;
}

const emptyData: DashboardData = {
  integrationStatus: [],
  metrics: { totalSkus: 0, syncedToday: 0, pendingSync: 0, errorCount: 0 },
  recentSyncs: [],
  alerts: [],
  inventoryOverview: { finishedGoods: 0, rawMaterials: 0, lowStock: 0, readyToShip: 0 },
  productionStats: { activeOrders: 0, completedToday: 0, onHold: 0 },
};

function MetricCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  href,
}: {
  title: string;
  value: number | string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: any;
  href?: string;
}) {
  const content = (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="flex items-center gap-1 text-sm">
                {changeType === "up" && <TrendingUp className="size-4 text-accent" />}
                {changeType === "down" && <TrendingDown className="size-4 text-destructive" />}
                <span
                  className={cn(
                    changeType === "up" && "text-accent",
                    changeType === "down" && "text-destructive",
                    changeType === "neutral" && "text-muted-foreground"
                  )}
                >
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className="bg-primary/10 rounded-lg p-3">
            <Icon className="text-primary size-6" />
          </div>
        </div>
        {href && (
          <div className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100">
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function IntegrationStatusCard({ integrations }: { integrations: DashboardData["integrationStatus"] }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="size-4 text-accent" />;
      case "error":
        return <XCircle className="size-4 text-destructive" />;
      default:
        return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="outline" className="border-accent/50 bg-accent/10 text-accent">Connected</Badge>;
      case "error":
        return <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">Error</Badge>;
      default:
        return <Badge variant="outline" className="border-muted-foreground/50 bg-muted text-muted-foreground">Disconnected</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Integration Status</CardTitle>
          <Link href="/dashboard/integrations">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              Manage <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {integrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No connections yet</p>
            <p className="text-xs text-muted-foreground">
              Connection status appears once you test or run a sync on the Integrations page.
            </p>
          </div>
        ) : (
          integrations.map((integration) => (
            <motion.div
              key={integration.platform}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(integration.status)}
                <div>
                  <p className="text-sm font-medium">{integration.platform}</p>
                  <p className="text-xs text-muted-foreground">
                    {integration.lastSync ? `Last sync: ${integration.lastSync}` : "Not connected"}
                  </p>
                </div>
              </div>
              {getStatusBadge(integration.status)}
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RecentSyncsCard({ syncs }: { syncs: DashboardData["recentSyncs"] }) {
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Syncs</CardTitle>
          <Link href="/dashboard/sync-logs">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {syncs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <RefreshCw className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No syncs yet</p>
            <p className="text-xs text-muted-foreground">
              Sync activity will appear here after the first Katana to Reverb sync runs.
            </p>
          </div>
        ) : (
          syncs.map((sync, index) => (
            <motion.div
              key={sync.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <RefreshCw className="text-primary size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{sync.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {sync.platform} - {sync.itemCount} items - {sync.createdAt}
                  </p>
                </div>
              </div>
              {getStatusBadge(sync.status)}
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AlertsCard({ alerts }: { alerts: DashboardData["alerts"] }) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "ERROR":
      case "CRITICAL":
        return <XCircle className="size-4 text-destructive" />;
      case "WARNING":
        return <AlertTriangle className="text-warning size-4" />;
      default:
        return <Activity className="text-primary size-4" />;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case "ERROR":
      case "CRITICAL":
        return "border-destructive/30 bg-destructive/5";
      case "WARNING":
        return "border-warning/30 bg-warning/5";
      default:
        return "border-primary/30 bg-primary/5";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Active Alerts</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {alerts.length}
            </Badge>
          </div>
          <Link href="/dashboard/sync-logs">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="mb-2 size-8 text-accent" />
            <p className="text-sm font-medium">All Clear</p>
            <p className="text-xs text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "rounded-lg border p-3",
                getSeverityClass(alert.severity)
              )}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.createdAt}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardClient({ initialData, error }: DashboardClientProps) {
  const data = initialData ?? emptyData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor inventory sync and integration health across all platforms.
        </p>
      </div>

      <PageIntro icon={Info}>
        This is your at-a-glance health check. It summarizes how many SKUs are mapped, what synced
        recently, whether Katana, Reverb and Shop Flow are connected, and surfaces any active
        alerts. Use the quick actions to jump straight into mapping, syncing, or the integration
        controls.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total SKUs"
          value={data.metrics.totalSkus.toLocaleString()}
          icon={Package}
          href="/dashboard/sku-mapping"
        />
        <MetricCard
          title="Synced Today"
          value={data.metrics.syncedToday}
          icon={RefreshCw}
          href="/dashboard/sync-logs"
        />
        <MetricCard
          title="Pending Sync"
          value={data.metrics.pendingSync}
          icon={Clock}
          href="/dashboard/inventory-sync"
        />
        <MetricCard
          title="Errors"
          value={data.metrics.errorCount}
          change={data.metrics.errorCount > 0 ? "Need attention" : undefined}
          changeType={data.metrics.errorCount > 0 ? "down" : undefined}
          icon={AlertTriangle}
          href="/dashboard/sync-logs"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Finished Goods"
          value={data.inventoryOverview.finishedGoods}
          icon={Package}
          href="/dashboard/inventory-sync"
        />
        <MetricCard
          title="Ready to Ship"
          value={data.inventoryOverview.readyToShip}
          icon={CheckCircle2}
          href="/dashboard/inventory-sync"
        />
        <MetricCard
          title="Raw Materials"
          value={data.inventoryOverview.rawMaterials}
          icon={Package}
          href="/dashboard/inventory-sync"
        />
        <MetricCard
          title="Low Stock Items"
          value={data.inventoryOverview.lowStock}
          change={data.inventoryOverview.lowStock > 0 ? "Action needed" : undefined}
          changeType={data.inventoryOverview.lowStock > 0 ? "down" : undefined}
          icon={AlertTriangle}
          href="/dashboard/inventory-sync"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <IntegrationStatusCard integrations={data.integrationStatus} />
        </div>
        <div className="lg:col-span-2">
          <RecentSyncsCard syncs={data.recentSyncs} />
        </div>
      </div>

      <AlertsCard alerts={data.alerts} />
    </div>
  );
}