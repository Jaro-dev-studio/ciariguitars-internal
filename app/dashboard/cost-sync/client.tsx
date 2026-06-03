"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Search,
  CheckCircle2,
  AlertTriangle,
  Package,
  Link2,
} from "lucide-react";
import Link from "next/link";
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
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { Info } from "lucide-react";

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
  averageCost: number | null;
  landedCost: number | null;
  lastSyncAt: string | null;
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof DollarSign;
  value: string | number;
  label: string;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", tone)}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CostSyncClient({ inventoryItems, error }: CostSyncClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const items: CostItem[] = (inventoryItems ?? []).map((item: any) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    averageCost: item.averageCost ?? null,
    landedCost: item.landedCost ?? null,
    lastSyncAt: item.lastKatanaSyncAt ?? null,
  }));

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const withCost = items.filter((i) => i.landedCost != null).length;
  const missingCost = items.length - withCost;
  const totalLandedValue = items.reduce((sum, i) => sum + (i.landedCost ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cost Sync</h1>
          <p className="text-muted-foreground">
            Average and landed costs from Katana, prepared for Shop Flow harmonization
          </p>
        </div>
      </div>

      <PageIntro icon={Info}>
        This page surfaces each item&apos;s average and landed cost from Katana so you can review
        cost accuracy before it flows into Shop Flow. Pushing these costs into Shop Flow is part of
        Phase 2 (Katana - Shop Flow harmony); for now the view is read-only and reflects live Katana
        cost data.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Pushing cost data into Shop Flow is part of Phase 2 and activates once the Shop Flow
        endpoints are available. This view shows the live Katana cost data that will be pushed.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={DollarSign}
          value={`$${totalLandedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          label="Total Landed Cost"
          tone="bg-primary/10 text-primary"
        />
        <StatCard icon={CheckCircle2} value={`${withCost}/${items.length}`} label="Items With Cost" tone="bg-accent/10 text-accent" />
        <StatCard icon={AlertTriangle} value={missingCost} label="Missing Cost Data" tone="bg-warning/10 text-warning" />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Cost Data</CardTitle>
              <CardDescription>
                {filteredItems.length} items - {missingCost} missing cost data
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
          {items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No cost data yet"
              description="Cost data comes from mapped Katana items. Create SKU mappings to populate this view with average and landed costs."
              action={
                <Link href="/dashboard/sku-mapping">
                  <Button variant="outline" size="sm">
                    <Link2 className="mr-2 size-4" />
                    Go to SKU Mapping
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Landed Cost</TableHead>
                    <TableHead>Shop Flow</TableHead>
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
                        item.landedCost == null && "bg-warning/5"
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
                        {item.averageCost != null ? `$${item.averageCost.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.landedCost != null ? `$${item.landedCost.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending Phase 2
                        </Badge>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
