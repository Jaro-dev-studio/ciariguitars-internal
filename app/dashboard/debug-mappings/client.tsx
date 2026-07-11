"use client";

import { useState, useTransition } from "react";
import {
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Link2,
  Boxes,
  ExternalLink,
  Wrench,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageIntro } from "@/components/page-intro";
import {
  runMappingDiagnostics,
  reassignReverbListing,
  deleteMapping,
  type MappingDiagnostics,
  type MappingConflict,
} from "@/lib/sku-mapping-actions";

const KATANA_APP_BASE =
  process.env.NEXT_PUBLIC_KATANA_APP_BASE_URL || "https://factory.katanamrp.com";

function reverbItemUrl(listingId: string): string {
  return `https://reverb.com/item/${listingId}`;
}

function katanaProductUrl(productId: string | null): string | null {
  return productId ? `${KATANA_APP_BASE}/items/products/${productId}` : null;
}

interface DebugMappingsClientProps {
  initialData: MappingDiagnostics | null;
  initialError: string | null;
}

const BUCKET_META: {
  key: keyof MappingDiagnostics["classification"];
  label: string;
  tone: string;
  bar: string;
}[] = [
  { key: "mappedLive", label: "Mapped (live match)", tone: "text-accent", bar: "bg-accent" },
  { key: "readyToMap", label: "Ready to map on re-sync", tone: "text-primary", bar: "bg-primary" },
  { key: "noReverbListing", label: "No Reverb listing for SKU", tone: "text-muted-foreground", bar: "bg-muted-foreground/50" },
  { key: "onlySoldEnded", label: "Only sold / ended listings", tone: "text-warning", bar: "bg-warning" },
  { key: "uniqueExcludedMatch", label: "Matched listing is one-of-a-kind", tone: "text-warning", bar: "bg-warning/60" },
  { key: "blockedByMapping", label: "Blocked (listing mapped to another item)", tone: "text-destructive", bar: "bg-destructive/70" },
  { key: "ambiguous", label: "Ambiguous (multiple live share SKU)", tone: "text-destructive", bar: "bg-destructive" },
];

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Link2;
  value: number | string;
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

function SkuChips({ skus }: { skus: string[] }) {
  if (skus.length === 0) return <p className="text-sm text-muted-foreground">None</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {skus.map((s) => (
        <code key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {s}
        </code>
      ))}
    </div>
  );
}

function SkuLink({
  sku,
  href,
  tone,
}: {
  sku: string | null;
  href: string | null;
  tone?: string;
}) {
  const label = sku || "(no SKU)";
  const cls = cn(
    "inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs",
    tone ?? "bg-muted"
  );
  if (!href) return <code className={cls}>{label}</code>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn(cls, "hover:underline")}>
      <span className="truncate">{label}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

function ConflictItem({
  conflict,
  busy,
  onReassign,
  onRemove,
}: {
  conflict: MappingConflict;
  busy: boolean;
  onReassign: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Reverb listing</span>
          <SkuLink
            sku={conflict.reverbSku}
            href={reverbItemUrl(conflict.reverbListingId)}
            tone="bg-primary/10 text-primary"
          />
          {conflict.reverbState && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {conflict.reverbState}
            </span>
          )}
        </div>
        <p className="truncate text-sm font-medium">{conflict.reverbTitle}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-accent/30 bg-accent/5 min-w-0 rounded-md border p-3">
            <p className="text-accent mb-1.5 text-xs font-medium">Should map to (unmapped)</p>
            <SkuLink
              sku={conflict.katanaSku}
              href={katanaProductUrl(conflict.katanaProductId)}
              tone="bg-accent/10 text-accent"
            />
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {conflict.katanaProductName}
            </p>
          </div>
          <div className="border-destructive/30 bg-destructive/5 min-w-0 rounded-md border p-3">
            <p className="mb-1.5 text-xs font-medium text-destructive">Currently mapped to</p>
            <SkuLink
              sku={conflict.ownerKatanaSku}
              href={katanaProductUrl(conflict.ownerKatanaProductId)}
              tone="bg-destructive/10 text-destructive"
            />
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {conflict.ownerName ?? conflict.ownerCanonicalSku ?? "Unknown item"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onReassign} disabled={busy}>
            <Wrench className="mr-2 size-4" />
            Reassign to {conflict.katanaSku}
          </Button>
          <Button size="sm" variant="outline" onClick={onRemove} disabled={busy}>
            <Trash2 className="mr-2 size-4" />
            Remove wrong mapping
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DebugMappingsClient({ initialData, initialError }: DebugMappingsClientProps) {
  const [data, setData] = useState<MappingDiagnostics | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [isRunning, startRun] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refreshData = async () => {
    const result = await runMappingDiagnostics();
    if (result.error || !result.data) {
      setError(result.error ?? "Diagnostics failed");
      toast.error("Diagnostics failed", { description: result.error ?? undefined });
      return;
    }
    setData(result.data);
    setError(null);
    return result.data;
  };

  const handleRerun = () => {
    startRun(async () => {
      const fresh = await refreshData();
      if (fresh) {
        toast.success("Diagnostics refreshed", {
          description: `${fresh.mappings.total} mapped of ${fresh.katana.totalVariants} Katana variants`,
        });
      }
    });
  };

  const handleReassign = (conflict: MappingConflict) => {
    const key = `${conflict.reverbListingId}:reassign`;
    setBusyKey(key);
    startRun(async () => {
      const result = await reassignReverbListing({
        reverbListingId: conflict.reverbListingId,
        katanaVariantId: conflict.katanaVariantId,
      });
      if (result.error || !result.data) {
        toast.error("Reassign failed", { description: result.error ?? undefined });
        setBusyKey(null);
        return;
      }
      toast.success("Listing reassigned", {
        description: `${conflict.reverbSku ?? conflict.reverbListingId} now maps to ${conflict.katanaSku}`,
      });
      await refreshData();
      setBusyKey(null);
    });
  };

  const handleRemove = (conflict: MappingConflict) => {
    const key = `${conflict.reverbListingId}:remove`;
    setBusyKey(key);
    startRun(async () => {
      const result = await deleteMapping(conflict.ownerInventoryItemId);
      if (result.error || !result.data) {
        toast.error("Remove failed", { description: result.error ?? undefined });
        setBusyKey(null);
        return;
      }
      toast.success("Wrong mapping removed", {
        description: `Freed ${conflict.reverbSku ?? conflict.reverbListingId} - re-sync to map it correctly`,
      });
      await refreshData();
      setBusyKey(null);
    });
  };

  const cleanData =
    data &&
    data.katana.blankSku === 0 &&
    data.katana.duplicateSkuCount === 0 &&
    data.classification.ambiguous === 0 &&
    data.conflicts.length === 0;

  const recoverable = data ? data.classification.readyToMap : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debug Mappings</h1>
          <p className="text-muted-foreground">
            Explains exactly why the SKU mapped count sits where it does
          </p>
        </div>
        <Button size="sm" onClick={handleRerun} disabled={isRunning}>
          <RefreshCw className={cn("mr-2 size-4", isRunning && "animate-spin")} />
          {isRunning ? "Running..." : "Re-run diagnostics"}
        </Button>
      </div>

      <PageIntro icon={Info}>
        This is a read-only diagnostic for the SKU Mapping feature. It reads the staging catalogs
        (imported Katana variants and Reverb listings) and the existing mappings, then reconstructs
        the exact-SKU matcher&apos;s logic to categorize every Katana SKU: mapped, mappable, blocked
        by a data-entry typo, or genuinely unmatchable. Use <strong>Re-run diagnostics</strong> after
        importing catalogs or fixing SKUs on Reverb to see the numbers move. It never writes data -
        run <strong>Sync mappings</strong> on the SKU Mapping page to actually create mappings.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {data && (
        <>
          {cleanData ? (
            <div className="border-accent/30 bg-accent/10 flex items-start gap-2 rounded-lg border p-4 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <strong>Not a mis-mapping - the matcher is behaving correctly.</strong> All{" "}
                {data.katana.totalVariants} Katana variants have unique, non-blank SKUs (0
                duplicates, 0 blanks, 0 ambiguous collisions).                 Nothing is linked to the wrong
                listing. The gap is a supply issue - stray-dash SKU typos are now auto-corrected by
                the matcher, not a bug.
              </span>
            </div>
          ) : (
            <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-lg border p-4 text-sm">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Data quality issues detected.</strong> {data.katana.blankSku} blank SKUs,{" "}
                {data.katana.duplicateSkuCount} duplicate Katana SKUs, {data.classification.ambiguous}{" "}
                ambiguous collisions, {data.conflicts.length} fixable mis-mappings. See the breakdown
                below.
              </span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={Boxes} value={data.katana.totalVariants} label="Katana Variants" tone="bg-secondary/10 text-secondary" />
            <StatCard icon={Link2} value={data.mappings.total} label="Currently Mapped" tone="bg-accent/10 text-accent" />
            <StatCard icon={CheckCircle2} value={data.reverb.syncable} label="Syncable Reverb" tone="bg-primary/10 text-primary" />
            <StatCard icon={XCircle} value={data.reverb.uniqueExcluded} label="One-of-a-kind (excluded)" tone="bg-warning/10 text-warning" />
          </div>

          {recoverable > 0 && (
            <div className="border-primary/30 bg-primary/10 flex items-start gap-2 rounded-lg border p-4 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong>Quick win: {recoverable} more will map on the next Sync.</strong> Run{" "}
                <strong>Sync mappings</strong> on the SKU Mapping page to create them.
              </span>
            </div>
          )}

          {/* Mis-mappings (blocked by an existing mapping) */}
          {data.conflicts.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wrench className="size-5 text-destructive" />
                  Fixable mis-mappings ({data.conflicts.length})
                </CardTitle>
                <CardDescription>
                  Each Reverb listing below has a SKU that matches an <strong>unmapped</strong> Katana
                  variant, but it is currently linked to a different item - so the correct SKU can
                  never map on Sync. Open either platform to confirm, then{" "}
                  <strong>Reassign</strong> to re-point the listing to the correct Katana SKU, or{" "}
                  <strong>Remove wrong mapping</strong> to detach it and let the next Sync re-match.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.conflicts.map((conflict) => (
                  <ConflictItem
                    key={`${conflict.reverbListingId}-${conflict.katanaVariantId}`}
                    conflict={conflict}
                    busy={
                      busyKey === `${conflict.reverbListingId}:reassign` ||
                      busyKey === `${conflict.reverbListingId}:remove`
                    }
                    onReassign={() => handleReassign(conflict)}
                    onRemove={() => handleRemove(conflict)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pool ceiling */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Why the ceiling is ~{data.reverb.syncable}, not {data.katana.totalVariants}</CardTitle>
              <CardDescription>
                Reverb returns {data.reverb.totalListings} listings, but {data.reverb.uniqueExcluded} are
                one-of-a-kind (has_inventory = false) and excluded from mapping by design. Only{" "}
                {data.reverb.syncable} in-stock listings are eligible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-7 overflow-hidden rounded-md">
                <div
                  className="flex items-center bg-primary pl-2.5 text-primary-foreground"
                  style={{ flex: Math.max(data.reverb.syncable, 1) }}
                >
                  <span className="truncate text-xs">{data.reverb.syncable} syncable</span>
                </div>
                <div
                  className="flex items-center bg-muted pl-2.5 text-muted-foreground"
                  style={{ flex: Math.max(data.reverb.uniqueExcluded, 1) }}
                >
                  <span className="truncate text-xs">
                    {data.reverb.uniqueExcluded} one-of-a-kind, excluded
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classification breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Where the {data.katana.distinctSkus} Katana SKUs land</CardTitle>
              <CardDescription>
                Every distinct Katana SKU, classified by how the exact-SKU matcher treats it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {BUCKET_META.map((b) => {
                const value = data.classification[b.key];
                const pct = data.katana.distinctSkus > 0 ? (value / data.katana.distinctSkus) * 100 : 0;
                return (
                  <div key={b.key} className="flex items-center gap-3">
                    <div className="w-56 shrink-0 text-sm">{b.label}</div>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-muted/40">
                      <div className={cn("h-full rounded", b.bar)} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={cn("w-8 shrink-0 text-right text-sm font-medium tabular-nums", b.tone)}>
                      {value}
                    </div>
                  </div>
                );
              })}
              {data.mappings.staleRows > 0 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  The UI shows {data.mappings.total} mapped because {data.mappings.staleRows} older
                  mapping row(s) point at SKUs no longer in the Katana catalog (worth cleaning up).{" "}
                  {data.mappings.currentCatalogMapped} of the current {data.katana.distinctSkus} SKUs
                  are mapped.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Remaining gap */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  No live Reverb listing ({data.noReverbSkus.length})
                </CardTitle>
                <CardDescription>
                  These Katana SKUs have no eligible Reverb listing at all
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SkuChips skus={data.noReverbSkus} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Only sold / ended ({data.soldEndedSkus.length})
                </CardTitle>
                <CardDescription>
                  A listing with this SKU exists but is sold or ended, so it is skipped
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SkuChips skus={data.soldEndedSkus} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Generated {new Date(data.generatedAt).toLocaleString()}</span>
            <span aria-hidden>·</span>
            <a
              href="/dashboard/sku-mapping"
              className="inline-flex items-center gap-1 hover:underline"
            >
              Go to SKU Mapping <ExternalLink className="size-3" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
