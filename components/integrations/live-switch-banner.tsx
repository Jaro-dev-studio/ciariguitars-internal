"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { LiveSwitchState } from "@/lib/integrations/live-switch";

interface SwitchCopy {
  title: string;
  body: string;
}

interface LiveSwitchBannerProps {
  id: string;
  /** Name of the switch, e.g. "Reverb link". */
  label: string;
  state: LiveSwitchState;
  live: SwitchCopy;
  off: SwitchCopy;
  /** Confirmation shown before switching on, and before switching off. */
  confirmOn: SwitchCopy;
  confirmOff: SwitchCopy;
  onSwitch: (live: boolean) => Promise<{ error: string | null }>;
}

/**
 * Banner with an on/off switch for a sync that writes stock. Every flip asks
 * for confirmation, and the banner shows who flipped it last.
 */
export function LiveSwitchBanner({
  id,
  label,
  state,
  live,
  off,
  confirmOn,
  confirmOff,
  onSwitch,
}: LiveSwitchBannerProps) {
  const router = useRouter();
  const [isSwitching, startSwitch] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const turningOn = !state.live;
  const copy = state.live ? live : off;
  const confirm = turningOn ? confirmOn : confirmOff;

  const handleConfirm = () => {
    startSwitch(async () => {
      const { error } = await onSwitch(turningOn);
      if (error) {
        toast.error(`Could not switch the ${label}`, { description: error });
        return;
      }
      toast.success(`${label} switched ${turningOn ? "on" : "off"}`);
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-start sm:justify-between",
        state.live ? "border-accent/40 bg-accent/10" : "border-warning/40 bg-warning/10"
      )}
    >
      <div className="flex items-start gap-3">
        {state.live ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
        ) : (
          <FlaskConical className="text-warning mt-0.5 size-4 shrink-0" />
        )}
        <div className="text-foreground">
          <p className="font-medium">{copy.title}</p>
          <p className="text-muted-foreground">
            {copy.body}
            {state.changedAt && (
              <>
                {" "}
                Switched {state.live ? "on" : "off"}
                {state.changedBy ? ` by ${state.changedBy}` : ""} on{" "}
                {new Date(state.changedAt).toLocaleString()}.
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Switch
          id={id}
          checked={state.live}
          disabled={isSwitching}
          onCheckedChange={() => setConfirmOpen(true)}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSwitching}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSwitching}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              {isSwitching ? "Switching..." : turningOn ? "Switch on" : "Switch off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
