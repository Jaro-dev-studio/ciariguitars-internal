"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Link2,
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SKUMapping {
  id: string;
  inventoryItemId: string;
  platform: string;
  externalSku: string;
  externalId: string | null;
  externalName: string | null;
  isActive: boolean;
  inventoryItem: {
    id: string;
    sku: string;
    name: string;
    category: string;
  };
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
}

interface SKUMappingClientProps {
  skuMappings: any[] | null;
  inventoryItems: any[] | null;
  error: string | null;
}

interface MockMapping {
  id: string;
  katanaSku: string;
  katanaName: string;
  category: string;
  mappings: {
    platform: string;
    externalSku: string;
    externalName: string;
    isActive: boolean;
  }[];
}

const mockMappings: MockMapping[] = [
  {
    id: "1",
    katanaSku: "CG-TELE-001",
    katanaName: "Classic Telecaster - Butterscotch Blonde",
    category: "FINISHED_GOOD",
    mappings: [
      { platform: "REVERB", externalSku: "RV-CG-TELE-001", externalName: "Ciari Classic Telecaster Butterscotch", isActive: true },
      { platform: "SHOPIFY", externalSku: "SH-TELE-BB", externalName: "Classic Telecaster - Butterscotch", isActive: true },
      { platform: "SHOPFLOW", externalSku: "CG-TELE-001", externalName: "Classic Telecaster", isActive: true },
    ],
  },
  {
    id: "2",
    katanaSku: "CG-STRAT-002",
    katanaName: "Modern Stratocaster - Sunburst",
    category: "FINISHED_GOOD",
    mappings: [
      { platform: "REVERB", externalSku: "RV-CG-STRAT-002", externalName: "Ciari Modern Strat 3-Color Sunburst", isActive: true },
      { platform: "SHOPIFY", externalSku: "SH-STRAT-SB", externalName: "Modern Stratocaster - Sunburst", isActive: true },
      { platform: "SHOPFLOW", externalSku: "CG-STRAT-002", externalName: "Modern Stratocaster", isActive: true },
    ],
  },
  {
    id: "3",
    katanaSku: "CG-LP-003",
    katanaName: "Les Paul Custom - Ebony",
    category: "FINISHED_GOOD",
    mappings: [
      { platform: "REVERB", externalSku: "RV-CG-LP-003", externalName: "Ciari LP Custom Black Beauty", isActive: true },
      { platform: "SHOPIFY", externalSku: "SH-LP-EB", externalName: "Les Paul Custom - Ebony", isActive: true },
      { platform: "SHOPFLOW", externalSku: "CG-LP-003", externalName: "Les Paul Custom", isActive: false },
    ],
  },
  {
    id: "4",
    katanaSku: "RAW-NCL-001",
    katanaName: "Nitrocellulose Lacquer - Clear",
    category: "RAW_MATERIAL",
    mappings: [
      { platform: "SHOPFLOW", externalSku: "RAW-NCL-001", externalName: "Nitro Lacquer Clear", isActive: true },
    ],
  },
  {
    id: "5",
    katanaSku: "CG-335-004",
    katanaName: "Semi-Hollow 335 Style - Cherry",
    category: "FINISHED_GOOD",
    mappings: [
      { platform: "REVERB", externalSku: "RV-CG-335-004", externalName: "Ciari 335 Cherry Red", isActive: true },
      { platform: "SHOPIFY", externalSku: "", externalName: "", isActive: false },
    ],
  },
  {
    id: "6",
    katanaSku: "CG-JAZZ-005",
    katanaName: "Jazz Bass - Olympic White",
    category: "FINISHED_GOOD",
    mappings: [
      { platform: "REVERB", externalSku: "RV-CG-JB-005", externalName: "Ciari Jazz Bass Olympic White", isActive: true },
      { platform: "SHOPIFY", externalSku: "SH-JB-OW", externalName: "Jazz Bass - Olympic White", isActive: true },
      { platform: "SHOPFLOW", externalSku: "CG-JAZZ-005", externalName: "Jazz Bass", isActive: true },
    ],
  },
];

const platforms = ["REVERB", "SHOPIFY", "SHOPFLOW"];

function AddMappingDialog({ onAdd }: { onAdd: (mapping: any) => void }) {
  const [open, setOpen] = useState(false);
  const [katanaSku, setKatanaSku] = useState("");
  const [platform, setPlatform] = useState("");
  const [externalSku, setExternalSku] = useState("");
  const [externalName, setExternalName] = useState("");

  const handleSubmit = () => {
    if (!katanaSku || !platform || !externalSku) {
      toast.error("Please fill in all required fields");
      return;
    }

    onAdd({
      katanaSku,
      platform,
      externalSku,
      externalName,
    });

    toast.success("Mapping created", {
      description: `${katanaSku} mapped to ${platform}:${externalSku}`,
    });

    setOpen(false);
    setKatanaSku("");
    setPlatform("");
    setExternalSku("");
    setExternalName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add Mapping
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create SKU Mapping</DialogTitle>
          <DialogDescription>
            Map a Katana SKU to an external platform SKU
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="katanaSku">Katana SKU</Label>
            <Input
              id="katanaSku"
              placeholder="e.g., CG-TELE-001"
              value={katanaSku}
              onChange={(e) => setKatanaSku(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="externalSku">External SKU</Label>
            <Input
              id="externalSku"
              placeholder="e.g., RV-CG-TELE-001"
              value={externalSku}
              onChange={(e) => setExternalSku(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="externalName">External Name (optional)</Label>
            <Input
              id="externalName"
              placeholder="Product name on platform"
              value={externalName}
              onChange={(e) => setExternalName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Mapping</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SKUMappingClient({ skuMappings, inventoryItems, error }: SKUMappingClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const mappings = mockMappings;

  const filteredMappings = mappings.filter(mapping => {
    const matchesSearch = 
      mapping.katanaSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.katanaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.mappings.some(m => 
        m.externalSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.externalName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesCategory = categoryFilter === "all" || mapping.category === categoryFilter;
    
    const matchesPlatform = platformFilter === "all" || 
      mapping.mappings.some(m => m.platform === platformFilter && m.isActive);

    return matchesSearch && matchesCategory && matchesPlatform;
  });

  const totalMappings = mappings.reduce((sum, m) => sum + m.mappings.filter(x => x.isActive).length, 0);
  const unmappedCount = mappings.filter(m => 
    m.category === "FINISHED_GOOD" && m.mappings.filter(x => x.isActive).length < 2
  ).length;

  const handleAddMapping = (mapping: any) => {
    console.log("Adding mapping:", mapping);
  };

  const handleImport = () => {
    toast.success("Import started", {
      description: "Importing SKU list from file...",
    });
  };

  const handleExport = () => {
    toast.success("Export started", {
      description: "Downloading SKU mappings as CSV...",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU Mapping Manager</h1>
          <p className="text-muted-foreground">
            Map items between Katana, Reverb, Shopify, and ShopFlow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="mr-2 size-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
          <AddMappingDialog onAdd={handleAddMapping} />
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
                <Link2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMappings}</p>
                <p className="text-xs text-muted-foreground">Active Mappings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <CheckCircle2 className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mappings.length}</p>
                <p className="text-xs text-muted-foreground">Katana Items</p>
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
                <p className="text-2xl font-bold">{unmappedCount}</p>
                <p className="text-xs text-muted-foreground">Needs Mapping</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <ArrowRight className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{platforms.length}</p>
                <p className="text-xs text-muted-foreground">Platforms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">SKU Mappings</CardTitle>
              <CardDescription>
                {filteredMappings.length} items - {unmappedCount} incomplete
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
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
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
                  <TableHead>Katana SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reverb</TableHead>
                  <TableHead>Shopify</TableHead>
                  <TableHead>ShopFlow</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map((mapping, index) => {
                  const reverbMapping = mapping.mappings.find(m => m.platform === "REVERB");
                  const shopifyMapping = mapping.mappings.find(m => m.platform === "SHOPIFY");
                  const shopflowMapping = mapping.mappings.find(m => m.platform === "SHOPFLOW");

                  const getMappingCell = (m: typeof reverbMapping) => {
                    if (!m || !m.externalSku) {
                      return (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <XCircle className="size-3.5" />
                          Not mapped
                        </span>
                      );
                    }
                    return (
                      <div className="flex items-center gap-1">
                        {m.isActive ? (
                          <CheckCircle2 className="size-3.5 text-accent" />
                        ) : (
                          <XCircle className="size-3.5 text-muted-foreground" />
                        )}
                        <span className={cn("font-mono text-xs", !m.isActive && "text-muted-foreground")}>
                          {m.externalSku}
                        </span>
                      </div>
                    );
                  };

                  return (
                    <motion.tr
                      key={mapping.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {mapping.katanaSku}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {mapping.katanaName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {mapping.category.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{getMappingCell(reverbMapping)}</TableCell>
                      <TableCell>{getMappingCell(shopifyMapping)}</TableCell>
                      <TableCell>{getMappingCell(shopflowMapping)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="size-8">
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
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
