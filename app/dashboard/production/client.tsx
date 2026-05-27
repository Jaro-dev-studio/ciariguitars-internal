"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Factory,
  Play,
  Pause,
  Square,
  Clock,
  Package,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Plus,
  ChevronRight,
  User,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductionOrder {
  id: string;
  orderNumber: string;
  productName: string;
  productSku: string;
  quantity: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  consumptions: {
    id: string;
    quantityConsumed: number;
    inventoryItem: { sku: string; name: string };
  }[];
  timers: {
    id: string;
    stepName: string;
    operatorName: string | null;
    startedAt: string;
    stoppedAt: string | null;
    durationSecs: number | null;
  }[];
}

interface ProductionClientProps {
  orders: any[] | null;
  error: string | null;
}

interface MockOrder {
  id: string;
  orderNumber: string;
  productName: string;
  productSku: string;
  quantity: number;
  status: "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
  progress: number;
  currentStep: string;
  operator: string;
  estimatedHours: number;
  actualHours: number;
  components: {
    sku: string;
    name: string;
    required: number;
    consumed: number;
    syncedToKatana: boolean;
  }[];
  timers: {
    id: string;
    stepName: string;
    operatorName: string;
    startedAt: string;
    stoppedAt: string | null;
    durationMins: number | null;
    isActive: boolean;
  }[];
}

const mockOrders: MockOrder[] = [
  {
    id: "1",
    orderNumber: "WO-2024-001",
    productName: "Classic Telecaster - Butterscotch Blonde",
    productSku: "CG-TELE-001",
    quantity: 2,
    status: "IN_PROGRESS",
    startedAt: "2024-01-14T09:00:00Z",
    completedAt: null,
    progress: 65,
    currentStep: "Neck Assembly",
    operator: "Mike Johnson",
    estimatedHours: 24,
    actualHours: 18,
    components: [
      { sku: "RAW-WOOD-ASH", name: "Swamp Ash Body Blank", required: 2, consumed: 2, syncedToKatana: true },
      { sku: "COMP-NECK-MH", name: "Maple Neck Blank", required: 2, consumed: 2, syncedToKatana: true },
      { sku: "RAW-NCL-001", name: "Nitrocellulose Lacquer", required: 1, consumed: 0, syncedToKatana: false },
      { sku: "COMP-PU-SC", name: "Single Coil Pickups Set", required: 2, consumed: 0, syncedToKatana: false },
    ],
    timers: [
      { id: "t1", stepName: "Body Routing", operatorName: "Mike Johnson", startedAt: "2024-01-14T09:00:00Z", stoppedAt: "2024-01-14T13:30:00Z", durationMins: 270, isActive: false },
      { id: "t2", stepName: "Neck Carving", operatorName: "Mike Johnson", startedAt: "2024-01-14T14:00:00Z", stoppedAt: "2024-01-14T18:00:00Z", durationMins: 240, isActive: false },
      { id: "t3", stepName: "Neck Assembly", operatorName: "Mike Johnson", startedAt: "2024-01-15T09:00:00Z", stoppedAt: null, durationMins: 120, isActive: true },
    ],
  },
  {
    id: "2",
    orderNumber: "WO-2024-002",
    productName: "Modern Stratocaster - Sunburst",
    productSku: "CG-STRAT-002",
    quantity: 1,
    status: "PLANNED",
    startedAt: null,
    completedAt: null,
    progress: 0,
    currentStep: "Pending Start",
    operator: "Unassigned",
    estimatedHours: 20,
    actualHours: 0,
    components: [
      { sku: "RAW-WOOD-ALD", name: "Alder Body Blank", required: 1, consumed: 0, syncedToKatana: false },
      { sku: "COMP-NECK-MR", name: "Maple/Rosewood Neck", required: 1, consumed: 0, syncedToKatana: false },
    ],
    timers: [],
  },
  {
    id: "3",
    orderNumber: "WO-2024-003",
    productName: "Les Paul Custom - Ebony",
    productSku: "CG-LP-003",
    quantity: 1,
    status: "ON_HOLD",
    startedAt: "2024-01-12T09:00:00Z",
    completedAt: null,
    progress: 40,
    currentStep: "Waiting for Parts",
    operator: "Sarah Chen",
    estimatedHours: 32,
    actualHours: 14,
    components: [
      { sku: "RAW-WOOD-MH", name: "Mahogany Body Blank", required: 1, consumed: 1, syncedToKatana: true },
      { sku: "RAW-WOOD-MAP", name: "Maple Top", required: 1, consumed: 1, syncedToKatana: true },
      { sku: "COMP-PU-HB", name: "Humbucker Pickups Set", required: 1, consumed: 0, syncedToKatana: false },
    ],
    timers: [
      { id: "t4", stepName: "Body Carving", operatorName: "Sarah Chen", startedAt: "2024-01-12T09:00:00Z", stoppedAt: "2024-01-12T17:00:00Z", durationMins: 480, isActive: false },
      { id: "t5", stepName: "Top Gluing", operatorName: "Sarah Chen", startedAt: "2024-01-13T09:00:00Z", stoppedAt: "2024-01-13T11:00:00Z", durationMins: 120, isActive: false },
    ],
  },
  {
    id: "4",
    orderNumber: "WO-2024-004",
    productName: "Jazz Bass - Olympic White",
    productSku: "CG-JAZZ-005",
    quantity: 1,
    status: "COMPLETED",
    startedAt: "2024-01-08T09:00:00Z",
    completedAt: "2024-01-12T16:00:00Z",
    progress: 100,
    currentStep: "Complete",
    operator: "Mike Johnson",
    estimatedHours: 18,
    actualHours: 20,
    components: [
      { sku: "RAW-WOOD-ALD", name: "Alder Body Blank", required: 1, consumed: 1, syncedToKatana: true },
      { sku: "COMP-NECK-MR", name: "Maple/Rosewood Neck", required: 1, consumed: 1, syncedToKatana: true },
      { sku: "COMP-PU-JB", name: "Jazz Bass Pickup Set", required: 1, consumed: 1, syncedToKatana: true },
    ],
    timers: [
      { id: "t6", stepName: "Full Build", operatorName: "Mike Johnson", startedAt: "2024-01-08T09:00:00Z", stoppedAt: "2024-01-12T16:00:00Z", durationMins: 1200, isActive: false },
    ],
  },
];

function OrderCard({ order }: { order: MockOrder }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(
    order.timers.find(t => t.isActive)?.id || null
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return "border-primary/50 bg-primary/10 text-primary";
      case "COMPLETED":
        return "border-accent/50 bg-accent/10 text-accent";
      case "ON_HOLD":
        return "border-warning/50 bg-warning/10 text-warning";
      default:
        return "border-muted-foreground/50 bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return <Play className="size-3" />;
      case "COMPLETED":
        return <CheckCircle2 className="size-3" />;
      case "ON_HOLD":
        return <Pause className="size-3" />;
      default:
        return <Clock className="size-3" />;
    }
  };

  const handleStartTimer = () => {
    toast.success("Timer started", {
      description: `Started timer for ${order.currentStep}`,
    });
  };

  const handleStopTimer = () => {
    toast.success("Timer stopped", {
      description: "Component consumption synced to Katana",
    });
  };

  const consumedCount = order.components.filter(c => c.consumed > 0).length;
  const syncedCount = order.components.filter(c => c.syncedToKatana).length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(order.status === "IN_PROGRESS" && "ring-2 ring-primary/20")}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-secondary/10 p-2.5">
                  <Factory className="size-5 text-secondary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                    <Badge variant="outline" className={cn("text-xs", getStatusColor(order.status))}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">{order.status.replace("_", " ")}</span>
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">{order.productName}</CardDescription>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    SKU: {order.productSku} - Qty: {order.quantity}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{order.progress}%</p>
                  <p className="text-xs text-muted-foreground">{order.currentStep}</p>
                </div>
                <ChevronRight className={cn(
                  "size-5 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </div>
            </div>
            <Progress value={order.progress} className="mt-3 h-2" />
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Package className="size-4" />
                  Component Consumption ({consumedCount}/{order.components.length})
                </h4>
                <div className="space-y-2">
                  {order.components.map((component) => (
                    <div key={component.sku} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {component.syncedToKatana ? (
                          <CheckCircle2 className="size-3.5 text-accent" />
                        ) : component.consumed > 0 ? (
                          <Clock className="size-3.5 text-warning" />
                        ) : (
                          <div className="size-3.5 rounded-full border border-muted-foreground" />
                        )}
                        <span className={cn(component.consumed === 0 && "text-muted-foreground")}>
                          {component.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs">
                        {component.consumed}/{component.required}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {syncedCount}/{order.components.length} synced to Katana
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Timer className="size-4" />
                  Production Timers
                </h4>
                <div className="space-y-2">
                  {order.timers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No timers recorded</p>
                  ) : (
                    order.timers.map((timer) => (
                      <div key={timer.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {timer.isActive ? (
                            <div className="size-2 animate-pulse rounded-full bg-accent" />
                          ) : (
                            <div className="size-2 rounded-full bg-muted-foreground" />
                          )}
                          <span>{timer.stepName}</span>
                        </div>
                        <span className="font-mono text-xs">
                          {timer.durationMins ? `${Math.floor(timer.durationMins / 60)}h ${timer.durationMins % 60}m` : "Running..."}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  {order.status === "IN_PROGRESS" && (
                    activeTimer ? (
                      <Button size="sm" variant="outline" onClick={handleStopTimer}>
                        <Square className="mr-1 size-3" />
                        Stop Timer
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleStartTimer}>
                        <Play className="mr-1 size-3" />
                        Start Timer
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-sm">{order.operator}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-sm">
                    {order.actualHours}h / {order.estimatedHours}h estimated
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {order.status === "PLANNED" && (
                  <Button size="sm">
                    <Play className="mr-1 size-3" />
                    Start Production
                  </Button>
                )}
                {order.status === "ON_HOLD" && (
                  <Button size="sm">
                    <Play className="mr-1 size-3" />
                    Resume
                  </Button>
                )}
                {order.status === "IN_PROGRESS" && (
                  <>
                    <Button size="sm" variant="outline">
                      <Pause className="mr-1 size-3" />
                      Hold
                    </Button>
                    <Button size="sm" variant="default">
                      <CheckCircle2 className="mr-1 size-3" />
                      Complete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function ProductionClient({ orders: serverOrders, error }: ProductionClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const orders = mockOrders;

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productSku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = orders.filter(o => o.status === "IN_PROGRESS").length;
  const plannedCount = orders.filter(o => o.status === "PLANNED").length;
  const onHoldCount = orders.filter(o => o.status === "ON_HOLD").length;
  const completedCount = orders.filter(o => o.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Production Orders</h1>
          <p className="text-muted-foreground">
            Track production progress and component consumption with Katana sync
          </p>
        </div>
        <Button>
          <Plus className="mr-2 size-4" />
          New Work Order
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setStatusFilter("IN_PROGRESS")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Play className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setStatusFilter("PLANNED")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <Clock className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{plannedCount}</p>
                <p className="text-xs text-muted-foreground">Planned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setStatusFilter("ON_HOLD")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <Pause className="size-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onHoldCount}</p>
                <p className="text-xs text-muted-foreground">On Hold</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setStatusFilter("COMPLETED")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2.5">
                <CheckCircle2 className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Search orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="PLANNED">Planned</SelectItem>
            <SelectItem value="ON_HOLD">On Hold</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order, index) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <OrderCard order={order} />
          </motion.div>
        ))}

        {filteredOrders.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Factory className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No production orders found</h3>
              <p className="text-sm text-muted-foreground">
                {statusFilter !== "all" 
                  ? "Try changing the filter or search term" 
                  : "Create a new work order to get started"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
