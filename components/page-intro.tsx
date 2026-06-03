import { type LucideIcon } from "lucide-react";

interface PageIntroProps {
  icon: LucideIcon;
  children: React.ReactNode;
}

export function PageIntro({ icon: Icon, children }: PageIntroProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
