"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Link2,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { runReverbSyncNow } from "@/lib/integration-actions";

interface InventorySyncClientProps {
  inventoryItems: any[] | null;
  error: string | null;
}

interface SyncRow {
  id: string;
  sku: string;
  title: string;
  katanaQty: number;
  reverbQty: number;
  listingId: string | null;
  reverbUrl: string | null;
  lastSync: string | null;
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Package;
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

export function InventorySyncClient({ inventoryItems, error }: InventorySyncClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [isSyncing, startSync] = useTransition();

  const items = inventoryItems ?? [];

  // Only items that have a Reverb listing mapped participate in the sync.
  const rows: SyncRow[] = items
    .map((item: any): SyncRow | null => {
      const reverbMapping = (item.skuMappings ?? []).find(
        (m: any) => m.platform === "REVERB"
      );
      if (!reverbMapping) return null;
      return {
        id: item.id,
        sku: item.sku,
        title: reverbMapping.externalName || item.name,
        katanaQty: item.katanaQty,
        reverbQty: item.reverbQty,
        listingId: reverbMapping.externalId ?? null,
        reverbUrl: reverbMapping.externalId
          ? `https://reverb.com/item/${reverbMapping.externalId}`
          : null,
        lastSync: item.lastReverbSyncAt ?? null,
      };
    })
    .filter((r): r is SyncRow => r !== null);

  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      row.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.title.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesSync = true;
    if (syncFilter === "synced") matchesSync = row.katanaQty === row.reverbQty;
    else if (syncFilter === "mismatch") matchesSync = row.katanaQty !== row.reverbQty;
    return matchesSearch && matchesSync;
  });

  const handleSync = () => {
    startSync(async () => {
      toast.info("Running Katana to Reverb sync...");
      const { data, error } = await runReverbSyncNow();
      if (error) {
        toast.error("Sync failed", { description: error });
        return;
      }
      toast.success(
        data && !data.writesEnabled ? "Sync complete (dry run)" : "Sync complete",
        {
          description: data
            ? `${data.updated} updated, ${data.unpublished} unpublished, ${data.skipped} skipped, ${data.failed} failed`
            : undefined,
        }
      );
      router.refresh();
    });
  };

  const mismatchCount = rows.filter((r) => r.katanaQty !== r.reverbQty).length;
  const inSyncCount = rows.length - mismatchCount;
  const outOfStock = rows.filter((r) => r.katanaQty <= 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Sync</h1>
          <p className="text-muted-foreground">Push Katana stock levels to Reverb</p>
        </div>
        <Button size="sm" onClick={handleSync} disabled={isSyncing || rows.length === 0}>
          <RefreshCw className={cn("mr-2 size-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      <PageIntro icon={Info}>
        This page keeps Reverb stock in line with Katana. For every mapped item it pushes the
        Katana <strong>net-available</strong> quantity (in stock minus committed) to the Reverb
        listing. When net-available reaches zero the listing is automatically unpublished, and
        prices and listing content are never touched. The sync runs automatically every 15 minutes;
        use <strong>Sync now</strong> to run it on demand.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Package} value={rows.length} label="Mapped Items" tone="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} value={inSyncCount} label="In Sync" tone="bg-accent/10 text-accent" />
        <StatCard icon={AlertTriangle} value={mismatchCount} label="Quantity Mismatch" tone="bg-warning/10 text-warning" />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Mapped Items</CardTitle>
              <CardDescription>
                {filteredRows.length} items - {mismatchCount} need updates, {outOfStock} out of stock
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search SKU or listing..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-8"
                />
              </div>
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
          {rows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No mapped items yet"
              description="Only items mapped to a Reverb listing are synced. Import your catalogs and create mappings on the SKU Mapping page to populate this list."
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
                    <TableHead>Listing</TableHead>
                    <TableHead>Canonical SKU</TableHead>
                    <TableHead className="text-center">Katana (net)</TableHead>
                    <TableHead className="text-center">Reverb</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => {
                    const isInSync = row.katanaQty === row.reverbQty;
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/50",
                          !isInSync && "bg-warning/5"
                        )}
                      >
                        <TableCell>
                          <p className="max-w-64 truncate font-medium">{row.title}</p>
                          {row.listingId && (
                            <p className="font-mono text-xs text-muted-foreground">
                              ID: {row.listingId}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                        <TableCell className="text-center font-mono font-medium">
                          {row.katanaQty}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono">{row.reverbQty}</span>
                            {isInSync ? (
                              <CheckCircle2 className="size-4 text-accent" />
                            ) : (
                              <AlertTriangle className="size-4 text-warning" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.katanaQty <= 0 ? (
                            <span className="text-xs text-muted-foreground">Unpublish at 0</span>
                          ) : isInSync ? (
                            <span className="text-xs text-accent">In sync</span>
                          ) : (
                            <span className="text-xs text-warning">Needs update</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {row.lastSync ? new Date(row.lastSync).toLocaleString() : "Never"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.reverbUrl && (
                            <a
                              href={row.reverbUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
