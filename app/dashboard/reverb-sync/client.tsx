"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  DollarSign,
  Eye,
  Settings,
  ArrowDownUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  katanaQty: number;
  reverbQty: number;
  retailPrice: number | null;
}

interface SKUMapping {
  id: string;
  inventoryItemId: string;
  platform: string;
  externalSku: string;
  externalId: string | null;
  externalName: string | null;
  isActive: boolean;
}

interface ReverbSyncClientProps {
  inventoryItems: any[] | null;
  skuMappings: any[] | null;
  error: string | null;
}

interface ReverbListing {
  id: string;
  sku: string;
  katanaSku: string;
  title: string;
  katanaQty: number;
  reverbQty: number;
  price: number;
  condition: string;
  status: "active" | "draft" | "sold";
  lastSync: string;
  reverbUrl: string;
}

const mockListings: ReverbListing[] = [
  { id: "1", sku: "CG-TELE-001", katanaSku: "CG-TELE-001", title: "Classic Telecaster - Butterscotch Blonde", katanaQty: 5, reverbQty: 5, price: 2499, condition: "Brand New", status: "active", lastSync: "2 mins ago", reverbUrl: "https://reverb.com/item/12345" },
  { id: "2", sku: "CG-STRAT-002", katanaSku: "CG-STRAT-002", title: "Modern Stratocaster - Sunburst", katanaQty: 3, reverbQty: 2, price: 2299, condition: "Brand New", status: "active", lastSync: "5 mins ago", reverbUrl: "https://reverb.com/item/12346" },
  { id: "3", sku: "CG-LP-003", katanaSku: "CG-LP-003", title: "Les Paul Custom - Ebony", katanaQty: 2, reverbQty: 2, price: 3499, condition: "Brand New", status: "active", lastSync: "5 mins ago", reverbUrl: "https://reverb.com/item/12347" },
  { id: "4", sku: "CG-335-004", katanaSku: "CG-335-004", title: "Semi-Hollow 335 Style - Cherry", katanaQty: 1, reverbQty: 1, price: 2899, condition: "Brand New", status: "active", lastSync: "5 mins ago", reverbUrl: "https://reverb.com/item/12348" },
  { id: "5", sku: "CG-JAZZ-005", katanaSku: "CG-JAZZ-005", title: "Jazz Bass - Olympic White", katanaQty: 4, reverbQty: 3, price: 1899, condition: "Brand New", status: "active", lastSync: "10 mins ago", reverbUrl: "https://reverb.com/item/12349" },
  { id: "6", sku: "CG-PRS-006", katanaSku: "CG-PRS-006", title: "PRS Style - Amber Flame", katanaQty: 0, reverbQty: 1, price: 2699, condition: "Brand New", status: "active", lastSync: "15 mins ago", reverbUrl: "https://reverb.com/item/12350" },
];

export function ReverbSyncClient({ inventoryItems, skuMappings, error }: ReverbSyncClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [preservePrice, setPreservePrice] = useState(true);

  const listings = mockListings;

  const filteredListings = listings.filter(listing => {
    const matchesSearch = 
      listing.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    
    let matchesSync = true;
    if (syncFilter === "synced") {
      matchesSync = listing.katanaQty === listing.reverbQty;
    } else if (syncFilter === "mismatch") {
      matchesSync = listing.katanaQty !== listing.reverbQty;
    }

    return matchesSearch && matchesStatus && matchesSync;
  });

  const handleSelectAll = () => {
    if (selectedItems.length === filteredListings.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredListings.map(item => item.id));
    }
  };

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleSyncSelected = async () => {
    if (selectedItems.length === 0) {
      toast.error("No listings selected");
      return;
    }

    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSyncing(false);
    toast.success("Reverb sync completed", {
      description: `Updated quantities for ${selectedItems.length} listings`,
    });
    setSelectedItems([]);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsSyncing(false);
    toast.success("Full Reverb sync completed", {
      description: `All ${listings.length} listings updated`,
    });
  };

  const activeCount = listings.filter(l => l.status === "active").length;
  const mismatchCount = listings.filter(l => l.katanaQty !== l.reverbQty).length;
  const totalValue = listings.reduce((sum, l) => sum + l.price * l.reverbQty, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reverb Quantity Sync</h1>
          <p className="text-muted-foreground">
            Synchronize listing quantities between Katana and Reverb marketplace
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing}>
            {isSyncing ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sync All
          </Button>
          <Button 
            size="sm" 
            onClick={handleSyncSelected}
            disabled={isSyncing || selectedItems.length === 0}
          >
            <ArrowDownUp className="mr-2 size-4" />
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Package className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active Listings</p>
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
                <p className="text-2xl font-bold">{activeCount - mismatchCount}</p>
                <p className="text-xs text-muted-foreground">In Sync</p>
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
                <p className="text-2xl font-bold">{mismatchCount}</p>
                <p className="text-xs text-muted-foreground">Quantity Mismatch</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <DollarSign className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Listed Value</p>
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
              <CardDescription>Configure how Reverb listings are synchronized</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
                <Label htmlFor="auto-sync" className="text-sm">Auto-sync every 15 min</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="preserve-price"
                  checked={preservePrice}
                  onCheckedChange={setPreservePrice}
                />
                <Label htmlFor="preserve-price" className="text-sm">Never overwrite prices</Label>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Reverb Listings</CardTitle>
              <CardDescription>
                {filteredListings.length} listings - {mismatchCount} need quantity updates
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search listings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
              <Select value={syncFilter} onValueChange={setSyncFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Sync Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
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
                      checked={selectedItems.length === filteredListings.length && filteredListings.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Katana Qty</TableHead>
                  <TableHead className="text-center">Reverb Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((listing, index) => {
                  const isInSync = listing.katanaQty === listing.reverbQty;
                  const needsUpdate = listing.katanaQty < listing.reverbQty;
                  
                  return (
                    <motion.tr
                      key={listing.id}
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
                          checked={selectedItems.includes(listing.id)}
                          onCheckedChange={() => handleSelectItem(listing.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-64">
                          <p className="truncate font-medium">{listing.title}</p>
                          <p className="text-xs text-muted-foreground">{listing.condition}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{listing.sku}</TableCell>
                      <TableCell className="text-center font-mono font-medium">
                        {listing.katanaQty}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono">{listing.reverbQty}</span>
                          {!isInSync && (
                            needsUpdate ? (
                              <AlertTriangle className="size-4 text-destructive" />
                            ) : (
                              <AlertTriangle className="size-4 text-warning" />
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${listing.price.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={cn(
                            listing.status === "active" && "border-accent/50 bg-accent/10 text-accent",
                            listing.status === "draft" && "border-muted-foreground/50 bg-muted text-muted-foreground",
                            listing.status === "sold" && "border-primary/50 bg-primary/10 text-primary"
                          )}
                        >
                          {listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {listing.lastSync}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a 
                          href={listing.reverbUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </a>
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
