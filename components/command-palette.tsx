"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  RefreshCw,
  Link2,
  DollarSign,
  Settings,
  FileText,
  Users,
  UserCircle,
} from "lucide-react";
import type { Permissions } from "@/config/permissions";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ElementType;
  section?: string;
  pageKey: string;
}

const allNavigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview", pageKey: "dashboard" },
  { href: "/dashboard/sku-mapping", label: "SKU Mapping", icon: Link2, section: "Inventory", pageKey: "skuMapping" },
  { href: "/dashboard/inventory-sync", label: "Inventory Sync", icon: RefreshCw, section: "Inventory", pageKey: "inventorySync" },
  { href: "/dashboard/cost-sync", label: "Cost Sync", icon: DollarSign, section: "Inventory", pageKey: "costSync" },
  { href: "/dashboard/integrations", label: "Integrations", icon: Settings, section: "System", pageKey: "integrations" },
  { href: "/dashboard/sync-logs", label: "Sync Logs", icon: FileText, section: "System", pageKey: "syncLogs" },
  { href: "/dashboard/users", label: "Users", icon: Users, section: "Admin", pageKey: "users" },
  { href: "/dashboard/profile", label: "Profile Settings", icon: UserCircle, pageKey: "profile" },
];

interface CommandPaletteProps {
  permissions: Permissions;
}

export function CommandPalette({ permissions }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const navigationItems = React.useMemo(
    () => allNavigationItems.filter((item) => permissions.pages[item.pageKey] === true),
    [permissions]
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Navigate to..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => handleSelect(item.href)}
                className="flex items-center gap-2"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span>{item.label}</span>
                {item.section && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {item.section}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
