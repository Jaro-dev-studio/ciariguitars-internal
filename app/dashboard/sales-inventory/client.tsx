"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Search,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  Eye,
  Filter,
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
import { cn } from "@/lib/utils";

interface SalesInventoryClientProps {
  inventoryItems: any[] | null;
  error: string | null;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  availableQty: number;
  reservedQty: number;
  inProductionQty: number;
  isReadyToShip: boolean;
  leadTimeDays: number | null;
  retailPrice: number;
  lastUpdated: string;
}

const mockInventoryItems: InventoryItem[] = [
  { id: "1", sku: "CG-TELE-001", name: "Classic Telecaster - Butterscotch Blonde", category: "Electric Guitar", availableQty: 5, reservedQty: 1, inProductionQty: 2, isReadyToShip: true, leadTimeDays: null, retailPrice: 2499, lastUpdated: "2 mins ago" },
  { id: "2", sku: "CG-STRAT-002", name: "Modern Stratocaster - Sunburst", category: "Electric Guitar", availableQty: 3, reservedQty: 0, inProductionQty: 1, isReadyToShip: true, leadTimeDays: null, retailPrice: 2299, lastUpdated: "5 mins ago" },
  { id: "3", sku: "CG-LP-003", name: "Les Paul Custom - Ebony", category: "Electric Guitar", availableQty: 2, reservedQty: 1, inProductionQty: 1, isReadyToShip: true, leadTimeDays: null, retailPrice: 3499, lastUpdated: "5 mins ago" },
  { id: "4", sku: "CG-335-004", name: "Semi-Hollow 335 Style - Cherry", category: "Electric Guitar", availableQty: 1, reservedQty: 0, inProductionQty: 0, isReadyToShip: true, leadTimeDays: null, retailPrice: 2899, lastUpdated: "10 mins ago" },
  { id: "5", sku: "CG-JAZZ-005", name: "Jazz Bass - Olympic White", category: "Bass Guitar", availableQty: 4, reservedQty: 1, inProductionQty: 0, isReadyToShip: true, leadTimeDays: null, retailPrice: 1899, lastUpdated: "5 mins ago" },
  { id: "6", sku: "CG-PRS-006", name: "PRS Style - Amber Flame", category: "Electric Guitar", availableQty: 0, reservedQty: 0, inProductionQty: 2, isReadyToShip: false, leadTimeDays: 14, retailPrice: 2699, lastUpdated: "1 hour ago" },
  { id: "7", sku: "CG-ACOU-007", name: "Acoustic Dreadnought - Natural", category: "Acoustic Guitar", availableQty: 2, reservedQty: 0, inProductionQty: 0, isReadyToShip: true, leadTimeDays: null, retailPrice: 1599, lastUpdated: "15 mins ago" },
  { id: "8", sku: "CG-PBASS-008", name: "P-Bass Style - Sunburst", category: "Bass Guitar", availableQty: 0, reservedQty: 0, inProductionQty: 1, isReadyToShip: false, leadTimeDays: 21, retailPrice: 1799, lastUpdated: "30 mins ago" },
  { id: "9", sku: "CG-TELE-009", name: "Telecaster Deluxe - Black", category: "Electric Guitar", availableQty: 1, reservedQty: 1, inProductionQty: 0, isReadyToShip: false, leadTimeDays: 7, retailPrice: 2699, lastUpdated: "20 mins ago" },
  { id: "10", sku: "CG-SG-010", name: "SG Style - Cherry", category: "Electric Guitar", availableQty: 3, reservedQty: 0, inProductionQty: 0, isReadyToShip: true, leadTimeDays: null, retailPrice: 2199, lastUpdated: "10 mins ago" },
];

export function SalesInventoryClient({ inventoryItems, error }: SalesInventoryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  const items = mockInventoryItems;

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    let matchesAvailability = true;
    if (availabilityFilter === "in_stock") {
      matchesAvailability = item.availableQty > 0;
    } else if (availabilityFilter === "ready_to_ship") {
      matchesAvailability = item.isReadyToShip && item.availableQty > 0;
    } else if (availabilityFilter === "in_production") {
      matchesAvailability = item.inProductionQty > 0;
    }

    return matchesSearch && matchesCategory && matchesAvailability;
  });

  const totalAvailable = items.reduce((sum, i) => sum + i.availableQty, 0);
  const readyToShipCount = items.filter(i => i.isReadyToShip && i.availableQty > 0).length;
  const inProductionCount = items.filter(i => i.inProductionQty > 0).length;
  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Inventory</h1>
          <p className="text-muted-foreground">
            Real-time inventory availability for sales team (read-only view)
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
          <Eye className="size-3" />
          Read-only View
        </Badge>
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
                <p className="text-2xl font-bold">{totalAvailable}</p>
                <p className="text-xs text-muted-foreground">Total Available</p>
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
                <p className="text-2xl font-bold">{readyToShipCount}</p>
                <p className="text-xs text-muted-foreground">Ready to Ship</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <Clock className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProductionCount}</p>
                <p className="text-xs text-muted-foreground">In Production</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <ShoppingCart className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-xs text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Available Inventory</CardTitle>
              <CardDescription>
                {filteredItems.length} products - Last sync: just now
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
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
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                  <SelectItem value="in_production">In Production</SelectItem>
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
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="text-center">Reserved</TableHead>
                  <TableHead className="text-center">In Production</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => {
                  const netAvailable = item.availableQty - item.reservedQty;
                  
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Updated {item.lastUpdated}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-mono font-medium",
                          netAvailable === 0 && "text-muted-foreground",
                          netAvailable > 0 && "text-accent"
                        )}>
                          {netAvailable}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.reservedQty > 0 ? (
                          <span className="font-mono text-warning">{item.reservedQty}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.inProductionQty > 0 ? (
                          <span className="font-mono text-primary">{item.inProductionQty}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${item.retailPrice.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {item.isReadyToShip && netAvailable > 0 ? (
                          <Badge className="bg-accent/10 text-accent hover:bg-accent/20">
                            <Truck className="mr-1 size-3" />
                            Ready to Ship
                          </Badge>
                        ) : item.inProductionQty > 0 ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                            <Clock className="mr-1 size-3" />
                            {item.leadTimeDays ? `${item.leadTimeDays} days` : "In Production"}
                          </Badge>
                        ) : netAvailable > 0 ? (
                          <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
                            <AlertTriangle className="mr-1 size-3" />
                            Available
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Out of Stock
                          </Badge>
                        )}
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <h4 className="mb-2 text-sm font-medium">Legend</h4>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge className="bg-accent/10 text-accent hover:bg-accent/20 text-xs">
                  <Truck className="mr-1 size-2.5" />
                  Ready to Ship
                </Badge>
                <span>Available and ready for immediate shipment</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs">
                  <Clock className="mr-1 size-2.5" />
                  In Production
                </Badge>
                <span>Currently being built - see lead time</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-warning/10 text-warning hover:bg-warning/20 text-xs">
                  <AlertTriangle className="mr-1 size-2.5" />
                  Available
                </Badge>
                <span>In stock but may need prep before shipping</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
