import {
  Ban,
  CheckCircle2,
  Clock,
  FlaskConical,
  Globe,
  Hand,
  Loader2,
  Timer,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Renders a SyncLog status. SKIPPED is its own state - it means the run
 * deliberately did nothing (already in sync, or dry run) - and must not be
 * conflated with PENDING, which means the entry was never resolved.
 */
export function SyncStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return (
        <Badge className="gap-1 border-transparent bg-accent/10 text-accent hover:bg-accent/20">
          <CheckCircle2 className="size-3" />
          Success
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="gap-1 border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    case "PARTIAL":
      return (
        <Badge className="bg-warning/10 text-warning hover:bg-warning/20 gap-1 border-transparent">
          <TriangleAlert className="size-3" />
          Partial
        </Badge>
      );
    case "SKIPPED":
      return (
        <Badge variant="secondary" className="gap-1">
          <Ban className="size-3" />
          Skipped
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="size-3" />
          Pending
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/** Renders what triggered a run: a cron, an inbound webhook or a person. */
export function SyncSourceBadge({ source }: { source: string }) {
  const config: Record<
    string,
    { label: string; icon: typeof Timer; className: string }
  > = {
    CRON: {
      label: "Cron",
      icon: Timer,
      className: "bg-primary/10 text-primary border-transparent",
    },
    WEBHOOK: {
      label: "Webhook",
      icon: Globe,
      className: "border-transparent bg-accent/10 text-accent",
    },
    MANUAL: {
      label: "Manual",
      icon: Hand,
      className: "bg-warning/10 text-warning border-transparent",
    },
    SYSTEM: {
      label: "System",
      icon: FlaskConical,
      className: "text-muted-foreground",
    },
  };

  const { label, icon: Icon, className } = config[source] ?? config.SYSTEM;

  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

export function SyncRunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "SUCCESS":
      return (
        <Badge className="gap-1 border-transparent bg-accent/10 text-accent hover:bg-accent/20">
          <CheckCircle2 className="size-3" />
          Success
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="gap-1 border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Running
        </Badge>
      );
  }
}

export function DryRunBadge() {
  return (
    <Badge
      variant="outline"
      className="border-warning/40 bg-warning/10 text-warning gap-1"
    >
      <FlaskConical className="size-3" />
      Dry run
    </Badge>
  );
}
