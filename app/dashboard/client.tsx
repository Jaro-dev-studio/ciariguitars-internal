"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Package,
  Factory,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const mockData: DashboardData = {
  integrationStatus: [
    { platform: "Katana", status: "connected", lastSync: "2 mins ago" },
    { platform: "Reverb", status: "connected", lastSync: "5 mins ago" },
    { platform: "Shopify", status: "connected", lastSync: "3 mins ago" },
    { platform: "ShipStation", status: "connected", lastSync: "10 mins ago" },
    { platform: "ManageMarkets", status: "disconnected", lastSync: null },
    { platform: "ShopFlow", status: "connected", lastSync: "1 min ago" },
  ],
  metrics: {
    totalSkus: 847,
    syncedToday: 234,
    pendingSync: 12,
    errorCount: 3,
  },
  recentSyncs: [
    { id: "1", type: "Inventory Quantity", platform: "Katana", status: "SUCCESS", createdAt: "2 mins ago", itemCount: 45 },
    { id: "2", type: "Listing Update", platform: "Reverb", status: "SUCCESS", createdAt: "5 mins ago", itemCount: 12 },
    { id: "3", type: "Cost Sync", platform: "ShopFlow", status: "PARTIAL", createdAt: "8 mins ago", itemCount: 28 },
    { id: "4", type: "Production Consumption", platform: "Katana", status: "SUCCESS", createdAt: "15 mins ago", itemCount: 8 },
    { id: "5", type: "Inventory Quantity", platform: "Shopify", status: "FAILED", createdAt: "22 mins ago", itemCount: 0 },
  ],
  alerts: [
    { id: "1", type: "QUANTITY_MISMATCH", severity: "WARNING", title: "Quantity Mismatch", message: "SKU CG-TELE-001 shows different quantities across platforms", createdAt: "10 mins ago" },
    { id: "2", type: "LOW_STOCK", severity: "WARNING", title: "Low Stock Alert", message: "Nitrocellulose Lacquer (RAW-NCL-001) is below reorder point", createdAt: "1 hour ago" },
    { id: "3", type: "SYNC_FAILURE", severity: "ERROR", title: "Sync Failed", message: "Shopify inventory sync failed - API rate limit exceeded", createdAt: "22 mins ago" },
  ],
  inventoryOverview: {
    finishedGoods: 156,
    rawMaterials: 423,
    lowStock: 18,
    readyToShip: 89,
  },
  productionStats: {
    activeOrders: 12,
    completedToday: 4,
    onHold: 2,
  },
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
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="size-6 text-primary" />
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
        {integrations.map((integration) => (
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
        ))}
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
        {syncs.map((sync, index) => (
          <motion.div
            key={sync.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <RefreshCw className="size-4 text-primary" />
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
        ))}
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
        return <AlertTriangle className="size-4 text-warning" />;
      default:
        return <Activity className="size-4 text-primary" />;
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

function QuickActionsCard() {
  const actions = [
    { label: "Run Full Sync", icon: RefreshCw, href: "/dashboard/inventory-sync" },
    { label: "View Inventory", icon: Package, href: "/dashboard/sales-inventory" },
    { label: "Production Orders", icon: Factory, href: "/dashboard/production" },
    { label: "Manage SKUs", icon: Zap, href: "/dashboard/sku-mapping" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        <CardDescription>Frequently used operations</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link key={action.label} href={action.href}>
            <Button
              variant="outline"
              className="h-auto w-full flex-col gap-2 py-4 hover:bg-primary/5 hover:border-primary/30"
            >
              <action.icon className="size-5 text-primary" />
              <span className="text-xs">{action.label}</span>
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardClient({ initialData, error }: DashboardClientProps) {
  const data = initialData || mockData;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor inventory sync, production status, and integration health across all platforms.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total SKUs"
          value={data.metrics.totalSkus.toLocaleString()}
          change="+12 this week"
          changeType="up"
          icon={Package}
          href="/dashboard/sku-mapping"
        />
        <MetricCard
          title="Synced Today"
          value={data.metrics.syncedToday}
          change="+15% vs yesterday"
          changeType="up"
          icon={RefreshCw}
          href="/dashboard/sync-logs"
        />
        <MetricCard
          title="Pending Sync"
          value={data.metrics.pendingSync}
          changeType="neutral"
          icon={Clock}
          href="/dashboard/inventory-sync"
        />
        <MetricCard
          title="Errors"
          value={data.metrics.errorCount}
          change="3 need attention"
          changeType="down"
          icon={AlertTriangle}
          href="/dashboard/sync-logs"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Finished Goods"
          value={data.inventoryOverview.finishedGoods}
          icon={Package}
          href="/dashboard/sales-inventory"
        />
        <MetricCard
          title="Ready to Ship"
          value={data.inventoryOverview.readyToShip}
          icon={CheckCircle2}
          href="/dashboard/sales-inventory"
        />
        <MetricCard
          title="Active Production"
          value={data.productionStats.activeOrders}
          icon={Factory}
          href="/dashboard/production"
        />
        <MetricCard
          title="Low Stock Items"
          value={data.inventoryOverview.lowStock}
          change="Action needed"
          changeType="down"
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AlertsCard alerts={data.alerts} />
        </div>
        <div className="lg:col-span-1">
          <QuickActionsCard />
        </div>
      </div>
    </div>
  );
}