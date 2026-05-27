"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Search,
  Filter,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Play,
  Pause,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  katanaQty: number;
  reverbQty: number;
  shopifyQty: number;
  shopflowQty: number;
  lastKatanaSyncAt: string | null;
  lastReverbSyncAt: string | null;
  lastShopifySyncAt: string | null;
  isReadyToShip: boolean;
}

interface Integration {
  id: string;
  platform: string;
  isActive: boolean;
  lastSyncAt: string | null;
}

interface SyncConfig {
  id: string;
  syncType: string;
  isEnabled: boolean;
  frequencyMins: number;
  lastRunAt: string | null;
}

interface InventorySyncClientProps {
  inventoryItems: any[] | null;
  integrations: any[] | null;
  syncConfigs: any[] | null;
  error: string | null;
}

const mockInventoryItems: InventoryItem[] = [
  { id: "1", sku: "CG-TELE-001", name: "Classic Telecaster - Butterscotch Blonde", category: "FINISHED_GOOD", katanaQty: 5, reverbQty: 5, shopifyQty: 5, shopflowQty: 5, lastKatanaSyncAt: "2024-01-15T10:30:00Z", lastReverbSyncAt: "2024-01-15T10:31:00Z", lastShopifySyncAt: "2024-01-15T10:32:00Z", isReadyToShip: true },
  { id: "2", sku: "CG-STRAT-002", name: "Modern Stratocaster - Sunburst", category: "FINISHED_GOOD", katanaQty: 3, reverbQty: 3, shopifyQty: 2, shopflowQty: 3, lastKatanaSyncAt: "2024-01-15T10:30:00Z", lastReverbSyncAt: "2024-01-15T10:31:00Z", lastShopifySyncAt: "2024-01-14T08:00:00Z", isReadyToShip: true },
  { id: "3", sku: "CG-LP-003", name: "Les Paul Custom - Ebony", category: "FINISHED_GOOD", katanaQty: 2, reverbQty: 2, shopifyQty: 2, shopflowQty: 2, lastKatanaSyncAt: "2024-01-15T10:30:00Z", lastReverbSyncAt: "2024-01-15T10:31:00Z", lastShopifySyncAt: "2024-01-15T10:32:00Z", isReadyToShip: true },
  { id: "4", sku: "RAW-NCL-001", name: "Nitrocellulose Lacquer - Clear", category: "RAW_MATERIAL", katanaQty: 12, reverbQty: 0, shopifyQty: 0, shopflowQty: 12, lastKatanaSyncAt: "2024-01-15T09:00:00Z", lastReverbSyncAt: null, lastShopifySyncAt: null, isReadyToShip: false },
  { id: "5", sku: "RAW-WOOD-ASH", name: "Swamp Ash Body Blank", category: "RAW_MATERIAL", katanaQty: 8, reverbQty: 0, shopifyQty: 0, shopflowQty: 8, lastKatanaSyncAt: "2024-01-15T09:00:00Z", lastReverbSyncAt: null, lastShopifySyncAt: null, isReadyToShip: false },
  { id: "6", sku: "CG-335-004", name: "Semi-Hollow 335 Style - Cherry", category: "FINISHED_GOOD", katanaQty: 1, reverbQty: 1, shopifyQty: 1, shopflowQty: 1, lastKatanaSyncAt: "2024-01-15T10:30:00Z", lastReverbSyncAt: "2024-01-15T10:31:00Z", lastShopifySyncAt: "2024-01-15T10:32:00Z", isReadyToShip: true },
  { id: "7", sku: "COMP-NECK-MH", name: "Mahogany Neck Blank", category: "COMPONENT", katanaQty: 15, reverbQty: 0, shopifyQty: 0, shopflowQty: 15, lastKatanaSyncAt: "2024-01-15T09:00:00Z", lastReverbSyncAt: null, lastShopifySyncAt: null, isReadyToShip: false },
  { id: "8", sku: "CG-JAZZ-005", name: "Jazz Bass - Olympic White", category: "FINISHED_GOOD", katanaQty: 4, reverbQty: 4, shopifyQty: 3, shopflowQty: 4, lastKatanaSyncAt: "2024-01-15T10:30:00Z", lastReverbSyncAt: "2024-01-15T10:31:00Z", lastShopifySyncAt: "2024-01-14T16:00:00Z", isReadyToShip: true },
];

const mockIntegrations: Integration[] = [
  { id: "1", platform: "KATANA", isActive: true, lastSyncAt: "2024-01-15T10:30:00Z" },
  { id: "2", platform: "REVERB", isActive: true, lastSyncAt: "2024-01-15T10:31:00Z" },
  { id: "3", platform: "SHOPIFY", isActive: true, lastSyncAt: "2024-01-15T10:32:00Z" },
  { id: "4", platform: "SHOPFLOW", isActive: true, lastSyncAt: "2024-01-15T10:33:00Z" },
];

function SyncStatusBadge({ katanaQty, platformQty, platform }: { katanaQty: number; platformQty: number; platform: string }) {
  if (platformQty === 0 && platform !== "ShopFlow") return null;
  
  const inSync = katanaQty === platformQty;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{platformQty}</span>
      {inSync ? (
        <CheckCircle2 className="size-4 text-accent" />
      ) : (
        <AlertTriangle className="size-4 text-warning" />
      )}
    </div>
  );
}

function PlatformSyncCard({ 
  platform, 
  isActive, 
  lastSync, 
  itemCount, 
  syncedCount 
}: { 
  platform: string;
  isActive: boolean;
  lastSync: string | null;
  itemCount: number;
  syncedCount: number;
}) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
    toast.success(`${platform} sync completed`, {
      description: `Successfully synced ${syncedCount} items`,
    });
  };

  return (
    <Card className={cn(!isActive && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "size-3 rounded-full",
              isActive ? "bg-accent" : "bg-muted-foreground"
            )} />
            <div>
              <p className="font-medium">{platform}</p>
              <p className="text-xs text-muted-foreground">
                {lastSync ? `Last sync: ${new Date(lastSync).toLocaleTimeString()}` : "Never synced"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{syncedCount}/{itemCount}</p>
              <p className="text-xs text-muted-foreground">items synced</p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              disabled={!isActive || isSyncing}
              onClick={handleSync}
            >
              {isSyncing ? (
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

export function InventorySyncClient({ 
  inventoryItems: serverItems, 
  integrations: serverIntegrations,
  syncConfigs,
  error 
}: InventorySyncClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [syncStatusFilter, setSyncStatusFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const items = serverItems || mockInventoryItems;
  const integrations = serverIntegrations || mockIntegrations;

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    let matchesSyncStatus = true;
    if (syncStatusFilter === "synced") {
      matchesSyncStatus = item.katanaQty === item.reverbQty && item.katanaQty === item.shopifyQty;
    } else if (syncStatusFilter === "mismatch") {
      matchesSyncStatus = item.katanaQty !== item.reverbQty || item.katanaQty !== item.shopifyQty;
    }

    return matchesSearch && matchesCategory && matchesSyncStatus;
  });

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleBulkSync = async () => {
    if (selectedItems.length === 0) {
      toast.error("No items selected");
      return;
    }

    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
    toast.success("Sync completed", {
      description: `Successfully synced ${selectedItems.length} items across all platforms`,
    });
    setSelectedItems([]);
  };

  const finishedGoodsCount = items.filter(i => i.category === "FINISHED_GOOD").length;
  const mismatchCount = items.filter(i => 
    i.category === "FINISHED_GOOD" && (i.katanaQty !== i.reverbQty || i.katanaQty !== i.shopifyQty)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Sync</h1>
          <p className="text-muted-foreground">
            Synchronize inventory quantities from Katana to sales channels and ShopFlow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 size-4" />
            Export
          </Button>
          <Button 
            size="sm" 
            onClick={handleBulkSync}
            disabled={isSyncing || selectedItems.length === 0}
          >
            {isSyncing ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sync Selected ({selectedItems.length})
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {integrations.map(integration => (
          <PlatformSyncCard
            key={integration.id}
            platform={integration.platform}
            isActive={integration.isActive}
            lastSync={integration.lastSyncAt}
            itemCount={finishedGoodsCount}
            syncedCount={finishedGoodsCount - mismatchCount}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Inventory Items</CardTitle>
              <CardDescription>
                {filteredItems.length} items found - {mismatchCount} with quantity mismatches
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search SKU or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="FINISHED_GOOD">Finished Goods</SelectItem>
                  <SelectItem value="RAW_MATERIAL">Raw Materials</SelectItem>
                  <SelectItem value="COMPONENT">Components</SelectItem>
                </SelectContent>
              </Select>
              <Select value={syncStatusFilter} onValueChange={setSyncStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Sync Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="synced">In Sync</SelectItem>
                  <SelectItem value="mismatch">Mismatch</SelectItem>
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
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Katana</TableHead>
                  <TableHead className="text-center">Reverb</TableHead>
                  <TableHead className="text-center">Shopify</TableHead>
                  <TableHead className="text-center">ShopFlow</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => {
                  const hasReverb = item.category === "FINISHED_GOOD";
                  const hasShopify = item.category === "FINISHED_GOOD";
                  const isInSync = !hasReverb || (item.katanaQty === item.reverbQty && item.katanaQty === item.shopifyQty);
                  
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        !isInSync && "bg-warning/5"
                      )}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => handleSelectItem(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="max-w-48 truncate">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.category.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono font-medium">
                        {item.katanaQty}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasReverb ? (
                          <SyncStatusBadge katanaQty={item.katanaQty} platformQty={item.reverbQty} platform="Reverb" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasShopify ? (
                          <SyncStatusBadge katanaQty={item.katanaQty} platformQty={item.shopifyQty} platform="Shopify" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <SyncStatusBadge katanaQty={item.katanaQty} platformQty={item.shopflowQty} platform="ShopFlow" />
                      </TableCell>
                      <TableCell>
                        {isInSync ? (
                          <Badge className="bg-accent/10 text-accent hover:bg-accent/20">
                            In Sync
                          </Badge>
                        ) : (
                          <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
                            Mismatch
                          </Badge>
                        )}
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
