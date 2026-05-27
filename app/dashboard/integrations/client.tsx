"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Key,
  Link2,
  AlertTriangle,
  Clock,
  Shield,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface IntegrationsClientProps {
  integrations: any[] | null;
  syncConfigs: any[] | null;
  error: string | null;
}

interface MockIntegration {
  id: string;
  platform: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "error";
  lastSyncAt: string | null;
  apiKeyMasked: string | null;
  shopUrl: string | null;
  capabilities: string[];
  isActive: boolean;
}

const mockIntegrations: MockIntegration[] = [
  {
    id: "1",
    platform: "KATANA",
    name: "Katana MRP",
    description: "Manufacturing resource planning and inventory management",
    status: "connected",
    lastSyncAt: "2024-01-15T10:30:00Z",
    apiKeyMasked: "ka_****4f2b",
    shopUrl: null,
    capabilities: ["Inventory", "Work Orders", "BOMs", "Costs"],
    isActive: true,
  },
  {
    id: "2",
    platform: "REVERB",
    name: "Reverb Marketplace",
    description: "Musical instrument marketplace for listings and orders",
    status: "connected",
    lastSyncAt: "2024-01-15T10:31:00Z",
    apiKeyMasked: "rv_****8e3a",
    shopUrl: null,
    capabilities: ["Listings", "Orders", "Inventory"],
    isActive: true,
  },
  {
    id: "3",
    platform: "SHOPIFY",
    name: "Shopify Store",
    description: "E-commerce platform for online sales",
    status: "connected",
    lastSyncAt: "2024-01-15T10:32:00Z",
    apiKeyMasked: "shpat_****f9d1",
    shopUrl: "ciariguitars.myshopify.com",
    capabilities: ["Products", "Inventory", "Orders"],
    isActive: true,
  },
  {
    id: "4",
    platform: "SHIPSTATION",
    name: "ShipStation",
    description: "Shipping and fulfillment management for domestic orders",
    status: "connected",
    lastSyncAt: "2024-01-15T09:00:00Z",
    apiKeyMasked: "ss_****2c7b",
    shopUrl: null,
    capabilities: ["Carriers", "Rates", "Labels"],
    isActive: true,
  },
  {
    id: "5",
    platform: "MANAGEMARKETS",
    name: "ManageMarkets",
    description: "International shipping and customs management",
    status: "disconnected",
    lastSyncAt: null,
    apiKeyMasked: null,
    shopUrl: null,
    capabilities: ["Int'l Shipping", "Customs", "Duties"],
    isActive: false,
  },
  {
    id: "6",
    platform: "SHOPFLOW",
    name: "ShopFlow",
    description: "Internal production and sales tracking system",
    status: "connected",
    lastSyncAt: "2024-01-15T10:33:00Z",
    apiKeyMasked: "sf_****1a9e",
    shopUrl: "shopflow.ciariguitars.com",
    capabilities: ["Production", "Sales", "Inventory View"],
    isActive: true,
  },
];

interface MockSyncConfig {
  id: string;
  name: string;
  syncType: string;
  description: string;
  isEnabled: boolean;
  frequencyMins: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

const mockSyncConfigs: MockSyncConfig[] = [
  { id: "1", name: "Inventory Quantity Sync", syncType: "INVENTORY_QUANTITY", description: "Sync quantities from Katana to all platforms", isEnabled: true, frequencyMins: 15, lastRunAt: "2024-01-15T10:30:00Z", nextRunAt: "2024-01-15T10:45:00Z" },
  { id: "2", name: "Cost Sync", syncType: "INVENTORY_COST", description: "Push landed costs to ShopFlow", isEnabled: true, frequencyMins: 60, lastRunAt: "2024-01-15T10:00:00Z", nextRunAt: "2024-01-15T11:00:00Z" },
  { id: "3", name: "Production Consumption", syncType: "PRODUCTION_CONSUMPTION", description: "Auto-consume materials when timers start", isEnabled: true, frequencyMins: 5, lastRunAt: "2024-01-15T10:35:00Z", nextRunAt: "2024-01-15T10:40:00Z" },
  { id: "4", name: "Order Sync", syncType: "ORDER_SYNC", description: "Import orders from Reverb and Shopify", isEnabled: true, frequencyMins: 10, lastRunAt: "2024-01-15T10:30:00Z", nextRunAt: "2024-01-15T10:40:00Z" },
  { id: "5", name: "Listing Updates", syncType: "LISTING_UPDATE", description: "Update Reverb listings with current data", isEnabled: false, frequencyMins: 30, lastRunAt: "2024-01-14T18:00:00Z", nextRunAt: null },
];

function IntegrationCard({ integration }: { integration: MockIntegration }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsConnecting(false);
    toast.success(`${integration.name} connected`, {
      description: "API credentials verified successfully",
    });
  };

  const handleDisconnect = () => {
    toast.success(`${integration.name} disconnected`, {
      description: "Connection removed",
    });
  };

  const handleTestConnection = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsConnecting(false);
    toast.success("Connection test successful", {
      description: `${integration.name} API is responding`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="size-5 text-accent" />;
      case "error":
        return <AlertTriangle className="size-5 text-destructive" />;
      default:
        return <XCircle className="size-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className={cn(integration.status === "disconnected" && "opacity-70")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(integration.status)}
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              <CardDescription className="text-xs">{integration.platform}</CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline"
            className={cn(
              integration.status === "connected" && "border-accent/50 bg-accent/10 text-accent",
              integration.status === "error" && "border-destructive/50 bg-destructive/10 text-destructive",
              integration.status === "disconnected" && "border-muted-foreground/50"
            )}
          >
            {integration.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{integration.description}</p>
        
        <div className="flex flex-wrap gap-1">
          {integration.capabilities.map((cap) => (
            <Badge key={cap} variant="secondary" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>

        {integration.status === "connected" && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">API Key</span>
              <span className="font-mono text-xs">{integration.apiKeyMasked}</span>
            </div>
            {integration.shopUrl && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shop URL</span>
                <span className="font-mono text-xs">{integration.shopUrl}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="text-xs">
                {integration.lastSyncAt 
                  ? new Date(integration.lastSyncAt).toLocaleTimeString()
                  : "Never"}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {integration.status === "connected" ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleTestConnection}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <RefreshCw className="mr-1 size-3 animate-spin" />
                ) : (
                  <Zap className="mr-1 size-3" />
                )}
                Test
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="mr-1 size-3" />
                    Configure
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configure {integration.name}</DialogTitle>
                    <DialogDescription>Update API credentials and settings</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input type="password" defaultValue="****" />
                    </div>
                    {integration.platform === "SHOPIFY" && (
                      <div className="space-y-2">
                        <Label>Shop URL</Label>
                        <Input defaultValue={integration.shopUrl || ""} />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch id="active" defaultChecked={integration.isActive} />
                      <Label htmlFor="active">Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="destructive" onClick={handleDisconnect}>Disconnect</Button>
                    <Button>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full">
                  <Link2 className="mr-1 size-3" />
                  Connect
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect {integration.name}</DialogTitle>
                  <DialogDescription>Enter your API credentials to connect</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input placeholder="Enter API key" />
                  </div>
                  {integration.platform === "SHOPIFY" && (
                    <div className="space-y-2">
                      <Label>Shop URL</Label>
                      <Input placeholder="yourshop.myshopify.com" />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={handleConnect} disabled={isConnecting}>
                    {isConnecting ? (
                      <RefreshCw className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 size-4" />
                    )}
                    Connect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SyncConfigCard({ config }: { config: MockSyncConfig }) {
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [isRunning, setIsRunning] = useState(false);

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    toast.success(enabled ? "Sync enabled" : "Sync disabled", {
      description: config.name,
    });
  };

  const handleRunNow = async () => {
    setIsRunning(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRunning(false);
    toast.success("Sync completed", {
      description: `${config.name} ran successfully`,
    });
  };

  return (
    <Card className={cn(!isEnabled && "opacity-70")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={isEnabled} onCheckedChange={handleToggle} />
            <div>
              <p className="font-medium">{config.name}</p>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">Every {config.frequencyMins} min</p>
              <p className="text-xs text-muted-foreground">
                {config.lastRunAt 
                  ? `Last: ${new Date(config.lastRunAt).toLocaleTimeString()}`
                  : "Never run"}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              disabled={!isEnabled || isRunning}
              onClick={handleRunNow}
            >
              {isRunning ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationsClient({ integrations, syncConfigs, error }: IntegrationsClientProps) {
  const connectionData = mockIntegrations;
  const configData = mockSyncConfigs;

  const connectedCount = connectionData.filter(i => i.status === "connected").length;
  const enabledSyncs = configData.filter(c => c.isEnabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integration Settings</h1>
          <p className="text-muted-foreground">
            Connect and configure API integrations with external platforms
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <CheckCircle2 className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{connectedCount}/{connectionData.length}</p>
                <p className="text-xs text-muted-foreground">Connected Platforms</p>
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
                <p className="text-2xl font-bold">{enabledSyncs}/{configData.length}</p>
                <p className="text-xs text-muted-foreground">Active Sync Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <Shield className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">Secure</p>
                <p className="text-xs text-muted-foreground">All connections encrypted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Platform Connections</TabsTrigger>
          <TabsTrigger value="sync">Sync Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connectionData.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <IntegrationCard integration={integration} />
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Automated Sync Jobs</CardTitle>
              <CardDescription>
                Configure automatic synchronization schedules and rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configData.map((config, index) => (
                <motion.div
                  key={config.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SyncConfigCard config={config} />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
