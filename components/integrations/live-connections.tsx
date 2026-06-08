"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RefreshCw, Zap, ShoppingCart, Webhook, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  testConnections,
  runReverbSyncNow,
  previewReverbSync,
  pollReverbSalesNow,
  registerWebhooks,
  type ConnectionStatus,
} from "@/lib/integration-actions";

export function LiveConnections({ dryRun = true }: { dryRun?: boolean }) {
  const [statuses, setStatuses] = useState<ConnectionStatus[] | null>(null);
  const [isTesting, startTest] = useTransition();
  const [isSyncing, startSync] = useTransition();
  const [isPolling, startPoll] = useTransition();
  const [isRegistering, startRegister] = useTransition();
  const [webhookBase, setWebhookBase] = useState("");

  const refresh = () => {
    startTest(async () => {
      const { data, error } = await testConnections();
      if (error) {
        toast.error("Connection test failed", { description: error });
        return;
      }
      setStatuses(data);
    });
  };

  useEffect(() => {
    refresh();
    if (typeof window !== "undefined") {
      setWebhookBase(window.location.origin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = () => {
    startSync(async () => {
      // Under dry run, run the read-only preview instead of the (blocked) write.
      if (dryRun) {
        const { data, error } = await previewReverbSync();
        if (error || !data) {
          toast.error("Preview failed", { description: error ?? undefined });
          return;
        }
        toast.success("Reverb sync preview (dry run)", {
          description: `${data.willUpdate} would update, ${data.willUnpublish} would unpublish, ${data.noop} unchanged, ${data.skipped} skipped`,
        });
        return;
      }
      const { data, error } = await runReverbSyncNow();
      if (error) {
        toast.error("Reverb sync failed", { description: error });
        return;
      }
      if (data) {
        toast.success("Reverb sync complete", {
          description: `updated ${data.updated}, unpublished ${data.unpublished}, noop ${data.noop}, skipped ${data.skipped}, failed ${data.failed}`,
        });
      }
      refresh();
    });
  };

  const handlePoll = () => {
    startPoll(async () => {
      const { data, error } = await pollReverbSalesNow();
      if (error) {
        toast.error("Order poll failed", { description: error });
        return;
      }
      toast.success("Reverb orders polled", {
        description: `${data?.processed ?? 0} new order(s) processed`,
      });
      refresh();
    });
  };

  const handleRegister = () => {
    startRegister(async () => {
      const { data, error } = await registerWebhooks(webhookBase);
      if (error) {
        toast.error("Webhook registration failed", { description: error });
        return;
      }
      toast.success("Webhooks registered", {
        description: `Katana: ${data?.katana.length ?? 0}, Reverb: ${data?.reverb.length ?? 0}`,
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Live Connection Status</CardTitle>
            <CardDescription>
              Real-time checks against the Katana, Reverb and Shop Flow APIs
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isTesting}>
            <RefreshCw className={cn("mr-1 size-3", isTesting && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          {statuses?.map((s) => (
            <div
              key={s.platform}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3",
                !s.configured && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.ok ? (
                    <CheckCircle2 className="size-4 text-accent" />
                  ) : (
                    <XCircle className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{s.platform}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    s.writesEnabled
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-muted-foreground/40 text-muted-foreground"
                  )}
                >
                  {s.writesEnabled ? "writes on" : "read-only"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{s.detail}</p>
              <p className="text-xs text-muted-foreground">
                Last sync:{" "}
                {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : "Never"}
              </p>
            </div>
          ))}
          {!statuses && (
            <p className="text-sm text-muted-foreground">Checking connections...</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <RefreshCw className="mr-1 size-3 animate-spin" />
            ) : dryRun ? (
              <Eye className="mr-1 size-3" />
            ) : (
              <Zap className="mr-1 size-3" />
            )}
            {dryRun ? "Preview Katana to Reverb sync" : "Run Katana to Reverb sync"}
          </Button>
          <Button size="sm" variant="outline" onClick={handlePoll} disabled={isPolling}>
            {isPolling ? (
              <RefreshCw className="mr-1 size-3 animate-spin" />
            ) : (
              <ShoppingCart className="mr-1 size-3" />
            )}
            Poll Reverb orders
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Webhook className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Register webhooks</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Registers Katana inventory and Reverb order webhooks pointing at this
            app. Use the deployed public URL in production.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={webhookBase}
              onChange={(e) => setWebhookBase(e.target.value)}
              placeholder="https://your-app.vercel.app"
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegister}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <RefreshCw className="mr-1 size-3 animate-spin" />
              ) : (
                <Webhook className="mr-1 size-3" />
              )}
              Register
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
