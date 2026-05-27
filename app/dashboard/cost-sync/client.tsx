"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

interface CostSyncClientProps {
  inventoryItems: any[] | null;
  syncConfigs: any[] | null;
  error: string | null;
}

interface CostItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  katanaAvgCost: number;
  katanaLandedCost: number;
  shopflowCost: number | null;
  lastSyncAt: string | null;
  hasDiscrepancy: boolean;
}

const mockCostItems: CostItem[] = [
  { id: "1", sku: "CG-TELE-001", name: "Classic Telecaster - Butterscotch Blonde", category: "FINISHED_GOOD", katanaAvgCost: 850.00, katanaLandedCost: 920.00, shopflowCost: 920.00, lastSyncAt: "2024-01-15T10:30:00Z", hasDiscrepancy: false },
  { id: "2", sku: "CG-STRAT-002", name: "Modern Stratocaster - Sunburst", category: "FINISHED_GOOD", katanaAvgCost: 780.00, katanaLandedCost: 845.00, shopflowCost: 780.00, lastSyncAt: "2024-01-14T15:00:00Z", hasDiscrepancy: true },
  { id: "3", sku: "CG-LP-003", name: "Les Paul Custom - Ebony", category: "FINISHED_GOOD", katanaAvgCost: 1250.00, katanaLandedCost: 1380.00, shopflowCost: 1380.00, lastSyncAt: "2024-01-15T10:30:00Z", hasDiscrepancy: false },
  { id: "4", sku: "RAW-NCL-001", name: "Nitrocellulose Lacquer - Clear", category: "RAW_MATERIAL", katanaAvgCost: 45.00, katanaLandedCost: 52.00, shopflowCost: 45.00, lastSyncAt: "2024-01-13T08:00:00Z", hasDiscrepancy: true },
  { id: "5", sku: "RAW-WOOD-ASH", name: "Swamp Ash Body Blank", category: "RAW_MATERIAL", katanaAvgCost: 125.00, katanaLandedCost: 145.00, shopflowCost: 145.00, lastSyncAt: "2024-01-15T10:30:00Z", hasDiscrepancy: false },
  { id: "6", sku: "CG-335-004", name: "Semi-Hollow 335 Style - Cherry", category: "FINISHED_GOOD", katanaAvgCost: 980.00, katanaLandedCost: 1075.00, shopflowCost: null, lastSyncAt: null, hasDiscrepancy: false },
  { id: "7", sku: "COMP-NECK-MH", name: "Mahogany Neck Blank", category: "COMPONENT", katanaAvgCost: 85.00, katanaLandedCost: 98.00, shopflowCost: 98.00, lastSyncAt: "2024-01-15T10:30:00Z", hasDiscrepancy: false },
  { id: "8", sku: "CG-JAZZ-005", name: "Jazz Bass - Olympic White", category: "FINISHED_GOOD", katanaAvgCost: 720.00, katanaLandedCost: 795.00, shopflowCost: 720.00, lastSyncAt: "2024-01-12T14:00:00Z", hasDiscrepancy: true },
];

export function CostSyncClient({ inventoryItems, syncConfigs, error }: CostSyncClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [costTypeFilter, setCostTypeFilter] = useState<string>("landed");
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const items = mockCostItems;

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesDiscrepancy = !showDiscrepanciesOnly || item.hasDiscrepancy;

    return matchesSearch && matchesCategory && matchesDiscrepancy;
  });

  const handleSyncAll = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
    toast.success("Cost sync completed", {
      description: `Updated costs for ${items.length} items in ShopFlow`,
    });
  };

  const syncedCount = items.filter(i => i.shopflowCost !== null).length;
  const discrepancyCount = items.filter(i => i.hasDiscrepancy).length;
  const totalCostValue = items.reduce((sum, i) => sum + (i.katanaLandedCost * 1), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cost Sync</h1>
          <p className="text-muted-foreground">
            Sync average and landed costs from Katana to ShopFlow
          </p>
        </div>
        <Button onClick={handleSyncAll} disabled={isSyncing}>
          {isSyncing ? (
            <RefreshCw className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Sync All Costs
        </Button>
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
                <DollarSign className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalCostValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Cost Value</p>
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
                <p className="text-2xl font-bold">{syncedCount}/{items.length}</p>
                <p className="text-xs text-muted-foreground">Synced to ShopFlow</p>
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
                <p className="text-2xl font-bold">{discrepancyCount}</p>
                <p className="text-xs text-muted-foreground">Cost Discrepancies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <TrendingUp className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">15 min</p>
                <p className="text-xs text-muted-foreground">Sync Frequency</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Sync Settings</CardTitle>
              <CardDescription>Configure cost sync behavior</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cost Type to Sync</Label>
                <Select value={costTypeFilter} onValueChange={setCostTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="average">Average Cost</SelectItem>
                    <SelectItem value="landed">Landed Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="discrepancies"
                  checked={showDiscrepanciesOnly}
                  onCheckedChange={setShowDiscrepanciesOnly}
                />
                <Label htmlFor="discrepancies" className="text-sm">Show discrepancies only</Label>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Cost Data</CardTitle>
              <CardDescription>
                {filteredItems.length} items - {discrepancyCount} with cost differences
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search SKUs..."
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Katana Avg Cost</TableHead>
                  <TableHead className="text-right">Katana Landed</TableHead>
                  <TableHead className="text-right">ShopFlow Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/50",
                      item.hasDiscrepancy && "bg-warning/5"
                    )}
                  >
                    <TableCell className="font-mono text-sm font-medium">{item.sku}</TableCell>
                    <TableCell className="max-w-48 truncate">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.category.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${item.katanaAvgCost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${item.katanaLandedCost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.shopflowCost !== null ? (
                        <span className={cn(
                          "font-mono",
                          item.hasDiscrepancy && "text-warning"
                        )}>
                          ${item.shopflowCost.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.shopflowCost === null ? (
                        <Badge variant="outline" className="text-xs">Not synced</Badge>
                      ) : item.hasDiscrepancy ? (
                        <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
                          <AlertTriangle className="mr-1 size-3" />
                          Mismatch
                        </Badge>
                      ) : (
                        <Badge className="bg-accent/10 text-accent hover:bg-accent/20">
                          <CheckCircle2 className="mr-1 size-3" />
                          Synced
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.lastSyncAt 
                        ? new Date(item.lastSyncAt).toLocaleDateString() 
                        : "Never"}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
