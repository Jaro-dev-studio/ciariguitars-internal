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
  Eye,
  ArrowRight,
  Ban,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveSwitchBanner } from "@/components/integrations/live-switch-banner";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import {
  runReverbSyncNow,
  previewReverbSync,
  refreshInventorySnapshotNow,
  setReverbLinkLiveNow,
} from "@/lib/integration-actions";
import type { ReverbSyncPlan } from "@/lib/integrations/inventory-sync";
import type { ReverbLinkState } from "@/lib/integrations/reverb-link";

interface InventorySyncClientProps {
  inventoryItems: any[] | null;
  error: string | null;
  link: ReverbLinkState;
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

const KATANA_APP_BASE =
  process.env.NEXT_PUBLIC_KATANA_APP_BASE_URL || "https://factory.katanamrp.com";

function reverbItemUrl(listingId: string | null): string | null {
  return listingId ? `https://reverb.com/item/${listingId}` : null;
}

function katanaProductUrl(productId: string | null): string | null {
  return productId ? `${KATANA_APP_BASE}/product/${productId}` : null;
}

function ExternalTitleLink({
  href,
  children,
  className,
}: {
  href: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href) return <span className={cn("block truncate", className)}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex min-w-0 max-w-full items-center gap-1 hover:underline", className)}
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0 opacity-60" />
    </a>
  );
}

const PLAN_ACTION_META: Record<
  ReverbSyncPlan["items"][number]["action"],
  { label: string; className: string }
> = {
  update: { label: "Would update", className: "border-primary/40 bg-primary/10 text-primary" },
  unpublish: { label: "Would unpublish", className: "border-warning/40 bg-warning/10 text-warning" },
  noop: { label: "No change", className: "border-muted-foreground/30 bg-muted text-muted-foreground" },
  skip: { label: "Skipped", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

function PreviewPanel({ plan, onClose }: { plan: ReverbSyncPlan; onClose: () => void }) {
  // Skipped rows are listed too: each one is a listing the sync will not keep
  // in line with Katana until someone fixes it.
  const rows = plan.items.filter((i) => i.action !== "noop");
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="size-4" /> Sync preview (dry run)
            </CardTitle>
            <CardDescription>
              Read-only - generated {new Date(plan.generatedAt).toLocaleString()}. Nothing was
              written to Reverb.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className={PLAN_ACTION_META.update.className}>
            {plan.willUpdate} would update
          </Badge>
          <Badge variant="outline" className={PLAN_ACTION_META.unpublish.className}>
            {plan.willUnpublish} would unpublish
          </Badge>
          <Badge variant="outline" className={PLAN_ACTION_META.noop.className}>
            {plan.noop} no change
          </Badge>
          <Badge variant="outline" className={PLAN_ACTION_META.skip.className}>
            {plan.skipped} skipped
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Everything is already in sync - no updates or unpublishes would be made.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Canonical SKU</TableHead>
                  <TableHead className="text-center">Reverb now</TableHead>
                  <TableHead className="text-center"></TableHead>
                  <TableHead className="text-center">Target</TableHead>
                  <TableHead>Planned action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const meta = PLAN_ACTION_META[item.action];
                  // A draft or ended listing is published by an update, and only
                  // has its quantity zeroed by an "unpublish".
                  const isLive = item.currentState === "live";
                  const label =
                    item.action === "update" && !isLive
                      ? "Would publish"
                      : item.action === "unpublish" && !isLive
                        ? "Would set to 0"
                        : meta.label;
                  return (
                    <TableRow key={`${item.canonicalSku}-${item.reverbListingId}`}>
                      <TableCell className="max-w-[280px]">
                        <ExternalTitleLink
                          href={reverbItemUrl(item.reverbListingId)}
                          className="font-medium"
                        >
                          {item.reverbTitle ?? item.reverbListingId ?? "-"}
                        </ExternalTitleLink>
                        {item.currentState && (
                          <p className="text-xs text-muted-foreground">
                            state: {item.currentState}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <ExternalTitleLink href={katanaProductUrl(item.katanaProductId)}>
                          {item.canonicalSku}
                        </ExternalTitleLink>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {item.currentReverbQty ?? "-"}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        <ArrowRight className="mx-auto size-4" />
                      </TableCell>
                      <TableCell className="text-center font-mono font-medium">
                        {item.action === "unpublish"
                          ? isLive
                            ? "0 (unpublish)"
                            : "0"
                          : item.action === "skip"
                            ? "-"
                            : item.targetQty}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", meta.className)}>
                          {label}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InventorySyncClient({ inventoryItems, error, link }: InventorySyncClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [isSyncing, startSync] = useTransition();
  const [isPreviewing, startPreview] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const [plan, setPlan] = useState<ReverbSyncPlan | null>(null);

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

  const handleRefresh = () => {
    startRefresh(async () => {
      toast.info("Refreshing live quantities from Katana and Reverb...");
      const { data, error } = await refreshInventorySnapshotNow();
      if (error) {
        toast.error("Refresh failed", { description: error });
        return;
      }
      toast.success("Quantities refreshed", {
        description: data
          ? `${data.updated} item(s) updated${data.failed ? `, ${data.failed} failed` : ""}`
          : undefined,
      });
      router.refresh();
    });
  };

  const handlePreview = () => {
    startPreview(async () => {
      toast.info("Building dry-run preview...");
      const { data, error } = await previewReverbSync();
      if (error || !data) {
        toast.error("Preview failed", { description: error ?? undefined });
        return;
      }
      setPlan(data);
      const changes = data.willUpdate + data.willUnpublish;
      toast.success(
        changes > 0 ? `${changes} change(s) would be applied` : "No changes needed",
        {
          description: `${data.willUpdate} update, ${data.willUnpublish} unpublish, ${data.noop} unchanged, ${data.skipped} skipped`,
        }
      );
    });
  };

  const handleApply = () => {
    startSync(async () => {
      toast.info("Applying Katana to Reverb sync...");
      const { data, error } = await runReverbSyncNow();
      if (error) {
        toast.error("Sync failed", { description: error });
        return;
      }
      toast.success("Sync complete", {
        description: data
          ? `${data.updated} updated, ${data.unpublished} unpublished, ${data.skipped} skipped, ${data.failed} failed`
          : undefined,
      });
      setPlan(null);
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
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || rows.length === 0}
            title="Pull current Katana net-available and live Reverb quantities into the table. Read-only - nothing is pushed."
          >
            <RefreshCw className={cn("mr-2 size-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh quantities"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePreview}
            disabled={isPreviewing || rows.length === 0}
          >
            <Eye className={cn("mr-2 size-4", isPreviewing && "animate-pulse")} />
            {isPreviewing ? "Previewing..." : "Preview changes"}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isSyncing || rows.length === 0 || !link.live}
            title={!link.live ? "The Reverb link is off. Switch it on to apply changes." : undefined}
          >
            {!link.live ? (
              <Ban className="mr-2 size-4" />
            ) : (
              <RefreshCw className={cn("mr-2 size-4", isSyncing && "animate-spin")} />
            )}
            {isSyncing ? "Applying..." : "Apply sync"}
          </Button>
        </div>
      </div>

      <LiveSwitchBanner
        id="reverb-link-switch"
        label="Reverb link"
        state={link}
        live={{
          title: "Live - Reverb follows Katana, and Reverb sales come out of Katana automatically.",
          body: "Reverb sales no longer need entering in Katana by hand.",
        }}
        off={{
          title: "Dry run - the Reverb link is off, so nothing is written to Reverb or Katana.",
          body: "Use Preview changes to see what would happen. Reverb sales still need entering in Katana by hand.",
        }}
        confirmOn={{
          title: "Switch the Reverb link on?",
          body: "Every 15 minutes Reverb quantities will be set from Katana (listings at 0 are unpublished), and Reverb sales placed from now on will be taken out of Katana automatically, so stop entering them by hand. Run Preview changes first to check what the first sync will do.",
        }}
        confirmOff={{
          title: "Switch the Reverb link off?",
          body: "Nothing will be written to Reverb or Katana until it is switched back on. In the meantime, enter Reverb sales in Katana by hand.",
        }}
        onSwitch={setReverbLinkLiveNow}
      />

      <PageIntro icon={Info}>
        This page keeps Reverb stock in line with Katana. For every mapped item it pushes the
        Katana <strong>net-available</strong> quantity (in stock minus committed) to the Reverb
        listing. When net-available reaches zero the listing is automatically unpublished, and
        prices and listing content are never touched. <strong>Refresh quantities</strong> pulls the
        current Katana and Reverb numbers into the table without changing anything;{" "}
        <strong>Preview changes</strong> reads live data and shows what would happen without writing
        anything; <strong>Apply sync</strong> performs the writes now instead of waiting for the
        next scheduled run (only while the Reverb link is on).
      </PageIntro>

      {plan && <PreviewPanel plan={plan} onClose={() => setPlan(null)} />}

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
                              <AlertTriangle className="text-warning size-4" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.katanaQty <= 0 ? (
                            <span className="text-xs text-muted-foreground">Unpublish at 0</span>
                          ) : isInSync ? (
                            <span className="text-xs text-accent">In sync</span>
                          ) : (
                            <span className="text-warning text-xs">Needs update</span>
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
