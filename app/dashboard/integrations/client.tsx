"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  RefreshCw,
  Plug,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { Info } from "lucide-react";

interface IntegrationsClientProps {
  integrations: any[] | null;
  syncConfigs: any[] | null;
  error: string | null;
}

const SYNC_TYPE_LABELS: Record<string, string> = {
  INVENTORY_QUANTITY: "Inventory Quantity",
  INVENTORY_COST: "Cost Sync",
  PRODUCTION_CONSUMPTION: "Production Consumption",
  ORDER_SYNC: "Order Sync",
  SKU_MAPPING: "SKU Mapping",
  LISTING_UPDATE: "Listing Update",
};

export function IntegrationsClient({ integrations, syncConfigs, error }: IntegrationsClientProps) {
  const connections = integrations ?? [];
  const configs = syncConfigs ?? [];

  const connectedCount = connections.filter((i: any) => i.isActive).length;
  const enabledSyncs = configs.filter((c: any) => c.isEnabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integration Settings</h1>
        <p className="text-muted-foreground">
          Stored connection records and automated sync jobs. Credentials are managed via
          environment variables; use Live Connection Status above to test and trigger syncs.
        </p>
      </div>

      <PageIntro icon={Info}>
        This is the operations hub for the connections themselves. The live status panel lets you
        confirm Katana, Reverb and Shop Flow are reachable, manually run a sync, poll Reverb for new
        orders, and register webhooks. Below it you can see the stored connection records and which
        automated sync jobs are enabled. API keys and write feature-flags live in environment
        variables, not here.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <CheckCircle2 className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {connectedCount}/{connections.length}
                </p>
                <p className="text-xs text-muted-foreground">Active Connections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <RefreshCw className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {enabledSyncs}/{configs.length}
                </p>
                <p className="text-xs text-muted-foreground">Enabled Sync Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Records</CardTitle>
          <CardDescription>Persisted integration state and last sync times</CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="No connection records yet"
              description="A record is stored for each platform the first time it is tested or synced. Use Refresh in Live Connection Status above to create them."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {connections.map((c: any, index: number) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3",
                    !c.isActive && "opacity-70"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.platform}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        c.isActive
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-muted-foreground/40 text-muted-foreground"
                      )}
                    >
                      {c.isActive ? "active" : "inactive"}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {c.lastSyncAt
                      ? `Last sync: ${new Date(c.lastSyncAt).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automated Sync Jobs</CardTitle>
          <CardDescription>Scheduled synchronization configured in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="No sync jobs configured"
              description="The Katana to Reverb inventory sync and Reverb order polling run on a 15-minute cron. Per-job configuration records will appear here when created."
            />
          ) : (
            <div className="space-y-3">
              {configs.map((config: any, index: number) => (
                <motion.div
                  key={config.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-4",
                    !config.isEnabled && "opacity-70"
                  )}
                >
                  <div>
                    <p className="font-medium">
                      {SYNC_TYPE_LABELS[config.syncType] ?? config.syncType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Every {config.frequencyMins} min -{" "}
                      {config.lastRunAt
                        ? `last run ${new Date(config.lastRunAt).toLocaleString()}`
                        : "never run"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      config.isEnabled
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-muted-foreground/40 text-muted-foreground"
                    )}
                  >
                    {config.isEnabled ? "enabled" : "disabled"}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
