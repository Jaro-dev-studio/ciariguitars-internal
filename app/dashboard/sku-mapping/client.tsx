"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Link2,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Wand2,
  Info,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageIntro } from "@/components/page-intro";
import {
  importCatalogs,
  syncMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  autoSuggestMatches,
  autoMatchByExactSku,
  type MappingRow,
  type UnmappedKatana,
  type UnmappedReverb,
  type SuggestedMatch,
} from "@/lib/sku-mapping-actions";

interface SKUMappingClientProps {
  mappings: MappingRow[];
  unmappedKatana: UnmappedKatana[];
  unmappedReverb: UnmappedReverb[];
  katanaImported: number;
  reverbImported: number;
  error: string | null;
}

const KATANA_APP_BASE =
  process.env.NEXT_PUBLIC_KATANA_APP_BASE_URL || "https://factory.katanamrp.com";

function reverbItemUrl(listingId: string): string {
  return `https://reverb.com/item/${listingId}`;
}

function katanaProductUrl(productId: string | null): string | null {
  return productId ? `${KATANA_APP_BASE}/items/products/${productId}` : null;
}

function TitleLink({
  href,
  children,
  className,
}: {
  href: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href)
    return <span className={cn("block truncate", className)}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn("flex min-w-0 max-w-full items-center gap-1 hover:underline", className)}
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0 opacity-60" />
    </a>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Link2;
  value: number;
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

/** Searchable picker over a list, used for Katana variants and Reverb listings. */
function SearchablePicker<T>({
  items,
  getKey,
  getPrimary,
  getSecondary,
  value,
  onChange,
  placeholder,
}: {
  items: T[];
  getKey: (item: T) => string;
  getPrimary: (item: T) => string;
  getSecondary: (item: T) => string;
  value: string | null;
  onChange: (key: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items
      .filter(
        (i) =>
          getPrimary(i).toLowerCase().includes(q) ||
          getSecondary(i).toLowerCase().includes(q) ||
          getKey(i).toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [items, query, getPrimary, getSecondary, getKey]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No matches</p>
        ) : (
          filtered.map((item) => {
            const key = getKey(item);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50",
                  value === key && "bg-accent/10"
                )}
              >
                <span className="font-medium">{getPrimary(item)}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {getSecondary(item)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SKUMappingClient({
  mappings,
  unmappedKatana,
  unmappedReverb,
  katanaImported,
  reverbImported,
  error,
}: SKUMappingClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, startImport] = useTransition();
  const [isSyncing, startSync] = useTransition();
  const [isSuggesting, startSuggest] = useTransition();
  const [isMatching, startMatch] = useTransition();
  const [isSaving, startSave] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [addKatana, setAddKatana] = useState<string | null>(null);
  const [addReverb, setAddReverb] = useState<string | null>(null);

  const [editRow, setEditRow] = useState<MappingRow | null>(null);
  const [editReverb, setEditReverb] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<SuggestedMatch[] | null>(null);

  const filteredMappings = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return mappings.filter(
      (m) =>
        m.canonicalSku.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.reverbTitle ?? "").toLowerCase().includes(q) ||
        (m.reverbSku ?? "").toLowerCase().includes(q)
    );
  }, [mappings, searchTerm]);

  const reviewCount = useMemo(() => mappings.filter((m) => m.needsReview).length, [mappings]);

  const handleImport = () => {
    startImport(async () => {
      const { data, error } = await importCatalogs();
      if (error) {
        toast.error("Import failed", { description: error });
        return;
      }
      toast.success("Catalogs imported", {
        description: `${data?.katanaVariants ?? 0} Katana variants, ${data?.reverbListings ?? 0} Reverb listings`,
      });
      router.refresh();
    });
  };

  const handleSync = () => {
    startSync(async () => {
      const { data, error } = await syncMappings();
      if (error) {
        toast.error("Sync mappings failed", { description: error });
        return;
      }
      toast.success(`${data?.created ?? 0} new mapping(s) created`, {
        description: `Imported ${data?.reverbListings ?? 0} Reverb listings and ${data?.katanaVariants ?? 0} Katana variants. ${data?.ambiguous ?? 0} ambiguous, ${data?.skipped ?? 0} skipped.`,
      });
      router.refresh();
    });
  };

  const handleSuggest = () => {
    startSuggest(async () => {
      const { data, error } = await autoSuggestMatches();
      if (error) {
        toast.error("Auto-suggest failed", { description: error });
        return;
      }
      setSuggestions(data ?? []);
      toast.success(`${data?.length ?? 0} suggestion(s)`, {
        description: "Review and accept the matches below",
      });
    });
  };

  const handleAutoMatch = () => {
    startMatch(async () => {
      const { data, error } = await autoMatchByExactSku();
      if (error) {
        toast.error("Auto-match failed", { description: error });
        return;
      }
      toast.success(`${data?.created ?? 0} mapping(s) created by exact SKU`, {
        description: `${data?.ambiguous ?? 0} ambiguous, ${data?.skipped ?? 0} skipped`,
      });
      router.refresh();
    });
  };

  const handleAcceptSuggestion = (s: SuggestedMatch) => {
    startSave(async () => {
      const { error } = await createMapping({
        katanaVariantId: s.katanaVariantId,
        reverbListingId: s.reverbListingId,
      });
      if (error) {
        toast.error("Could not create mapping", { description: error });
        return;
      }
      toast.success("Mapping created", { description: s.katanaLabel });
      setSuggestions((prev) => prev?.filter((x) => x.katanaVariantId !== s.katanaVariantId) ?? null);
      router.refresh();
    });
  };

  const handleAdd = () => {
    if (!addKatana || !addReverb) {
      toast.error("Select both a Katana variant and a Reverb listing");
      return;
    }
    startSave(async () => {
      const { error } = await createMapping({
        katanaVariantId: addKatana,
        reverbListingId: addReverb,
      });
      if (error) {
        toast.error("Could not create mapping", { description: error });
        return;
      }
      toast.success("Mapping created");
      setAddOpen(false);
      setAddKatana(null);
      setAddReverb(null);
      router.refresh();
    });
  };

  const handleEdit = () => {
    if (!editRow || !editReverb) {
      toast.error("Select a Reverb listing");
      return;
    }
    startSave(async () => {
      const { error } = await updateMapping({
        inventoryItemId: editRow.inventoryItemId,
        reverbListingId: editReverb,
      });
      if (error) {
        toast.error("Could not update mapping", { description: error });
        return;
      }
      toast.success("Mapping updated");
      setEditRow(null);
      setEditReverb(null);
      router.refresh();
    });
  };

  const handleDelete = (row: MappingRow) => {
    if (!confirm(`Remove mapping for ${row.canonicalSku}? This unlinks Katana and Reverb for this item.`)) {
      return;
    }
    startSave(async () => {
      const { error } = await deleteMapping(row.inventoryItemId);
      if (error) {
        toast.error("Could not delete mapping", { description: error });
        return;
      }
      toast.success("Mapping removed");
      router.refresh();
    });
  };

  const handleExport = () => {
    const header = "canonical_sku,name,katana_variant_id,reverb_listing_id,reverb_sku,reverb_title\n";
    const rows = mappings
      .map((m) =>
        [
          m.canonicalSku,
          `"${m.name.replace(/"/g, "\"\"")}"`,
          m.katanaVariantId ?? "",
          m.reverbListingId ?? "",
          m.reverbSku ?? "",
          `"${(m.reverbTitle ?? "").replace(/"/g, "\"\"")}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sku-mappings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const notImported = katanaImported === 0 && reverbImported === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU Mapping Manager</h1>
          <p className="text-muted-foreground">
            Link Katana variants to Reverb listings (Reverb listings have no SKU, so
            matching is by listing ID)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={cn("mr-2 size-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync mappings"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport} disabled={isImporting}>
            <Download className={cn("mr-2 size-4", isImporting && "animate-spin")} />
            {isImporting ? "Importing..." : "Import catalogs"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={isMatching || notImported}>
            <Wand2 className={cn("mr-2 size-4", isMatching && "animate-spin")} />
            {isMatching ? "Matching..." : "Auto-match by SKU"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSuggest} disabled={isSuggesting || notImported}>
            <Sparkles className={cn("mr-2 size-4", isSuggesting && "animate-spin")} />
            Auto-suggest
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={mappings.length === 0}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} disabled={notImported}>
            <Plus className="mr-2 size-4" />
            Add Mapping
          </Button>
        </div>
      </div>

      <PageIntro icon={Info}>
        This is the foundation for every sync, linking each Katana variant to its Reverb listing.
        After adding or editing SKUs on Reverb, click <strong>Sync mappings</strong> - it re-imports
        both catalogs and auto-links every item whose Katana and Reverb SKUs now match, in one step
        (a plain page refresh only re-reads existing mappings, so the mapped count will not move on
        its own). The separate <strong>Import catalogs</strong>, <strong>Auto-match by SKU</strong>,
        and <strong>Auto-suggest</strong> (fuzzy title matches) buttons run those steps individually
        if needed. Mappings flagged <strong>Review</strong> point at a Reverb listing that has sold,
        ended, or had its SKU reassigned. Only mapped items are kept in sync.
      </PageIntro>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {notImported && (
        <div className="border-warning/30 bg-warning/10 rounded-lg border p-4 text-sm">
          No catalog data yet. Click <strong>Import catalogs</strong> to pull Katana
          variants and Reverb listings, then map them (or use Auto-suggest).
        </div>
      )}

      {reviewCount > 0 && (
        <div className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-lg border p-4 text-sm">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            <strong>{reviewCount} mapping(s) need review.</strong> Their Reverb listing has sold,
            ended, or had its SKU reassigned. Click <strong>Sync mappings</strong>, then edit or
            remove these so syncs target a live listing.
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Link2} value={mappings.length} label="Mapped Items" tone="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} value={katanaImported} label="Katana Variants" tone="bg-secondary/10 text-secondary" />
        <StatCard icon={AlertTriangle} value={unmappedKatana.length} label="Unmapped Katana" tone="bg-warning/10 text-warning" />
        <StatCard icon={XCircle} value={unmappedReverb.length} label="Unmapped Reverb" tone="bg-accent/10 text-accent" />
      </div>

      {suggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Suggested Matches</CardTitle>
            <CardDescription>
              Fuzzy matches between unmapped Katana variants and Reverb listings - confirm to create the mapping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.katanaVariantId}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <TitleLink href={katanaProductUrl(s.katanaProductId)} className="font-medium">
                    {s.katanaLabel}
                  </TitleLink>
                  <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                    to{" "}
                    <TitleLink href={reverbItemUrl(s.reverbListingId)} className="text-foreground">
                      {s.reverbTitle}
                    </TitleLink>
                  </span>
                  <Badge variant="outline" className="w-fit text-xs">
                    {Math.round(s.score * 100)}%
                  </Badge>
                </div>
                <Button size="sm" onClick={() => handleAcceptSuggestion(s)} disabled={isSaving}>
                  Accept
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">SKU Mappings</CardTitle>
              <CardDescription>{filteredMappings.length} mapped items</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search mappings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canonical SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Katana Variant</TableHead>
                  <TableHead>Reverb Listing</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No mappings yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMappings.map((m, index) => (
                    <motion.tr
                      key={m.inventoryItemId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-mono text-sm font-medium">{m.canonicalSku}</TableCell>
                      <TableCell className="max-w-48 truncate">{m.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.katanaVariantId ? (
                          <TitleLink href={katanaProductUrl(m.katanaProductId)}>
                            {m.katanaVariantId}
                          </TitleLink>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {m.reverbListingId ? (
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex min-w-0 items-center gap-1">
                              {m.needsReview ? (
                                <AlertTriangle className="text-warning size-3.5 shrink-0" />
                              ) : (
                                <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
                              )}
                              <TitleLink href={reverbItemUrl(m.reverbListingId)} className="text-xs">
                                {m.reverbTitle ?? m.reverbListingId}
                              </TitleLink>
                            </div>
                            {m.needsReview && m.reviewReason && (
                              <Badge variant="outline" className="border-warning/40 text-warning w-fit text-xs">
                                Review: {m.reviewReason}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="size-3.5" /> Not mapped
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="w-20">
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => {
                              setEditRow(m);
                              setEditReverb(m.reverbListingId);
                            }}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(m)}
                            disabled={isSaving}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add mapping dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create SKU Mapping</DialogTitle>
            <DialogDescription>
              Link an unmapped Katana variant to an unmapped Reverb listing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Katana variant ({unmappedKatana.length} unmapped)</Label>
              <SearchablePicker
                items={unmappedKatana}
                getKey={(i) => i.variantId}
                getPrimary={(i) => [i.productName, i.variantName].filter(Boolean).join(" - ")}
                getSecondary={(i) => i.sku ?? i.variantId}
                value={addKatana}
                onChange={setAddKatana}
                placeholder="Search Katana variants..."
              />
            </div>
            <div className="space-y-2">
              <Label>Reverb listing ({unmappedReverb.length} unmapped)</Label>
              <SearchablePicker
                items={unmappedReverb}
                getKey={(i) => i.listingId}
                getPrimary={(i) => i.title}
                getSecondary={(i) => `${i.listingId}${i.state ? ` - ${i.state}` : ""}`}
                value={addReverb}
                onChange={setAddReverb}
                placeholder="Search Reverb listings..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={isSaving || !addKatana || !addReverb}>
              Create Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit mapping dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Reverb Mapping</DialogTitle>
            <DialogDescription>
              {editRow ? `Change the Reverb listing linked to ${editRow.canonicalSku}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reverb listing</Label>
            <SearchablePicker
              items={unmappedReverb}
              getKey={(i) => i.listingId}
              getPrimary={(i) => i.title}
              getSecondary={(i) => `${i.listingId}${i.state ? ` - ${i.state}` : ""}`}
              value={editReverb}
              onChange={setEditReverb}
              placeholder="Search Reverb listings..."
            />
            {editRow?.reverbTitle && (
              <p className="text-xs text-muted-foreground">
                Currently: {editRow.reverbTitle}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={isSaving || !editReverb}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
