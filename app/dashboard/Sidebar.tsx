"use client";

import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  LogOut,
  Users,
  X,
  UserCircle,
  LayoutDashboard,
  RefreshCw,
  Link2,
  DollarSign,
  Settings,
  FileText,
  Bug,
  Music,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Permissions } from "@/config/permissions";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
  permissions: Permissions;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  pageKey: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const allNavigationSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { href: "/dashboard/sku-mapping", label: "SKU Mapping", icon: Link2, pageKey: "skuMapping" },
      { href: "/dashboard/inventory-sync", label: "Inventory Sync", icon: RefreshCw, pageKey: "inventorySync" },
      { href: "/dashboard/cost-sync", label: "Cost Sync", icon: DollarSign, pageKey: "costSync" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: Settings, pageKey: "integrations" },
      { href: "/dashboard/sync-logs", label: "Sync Logs", icon: FileText, pageKey: "syncLogs" },
      { href: "/dashboard/debug-mappings", label: "Debug Mappings", icon: Bug, pageKey: "debugMappings" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users, pageKey: "users" },
    ],
  },
];

const bottomNavigation: NavItem[] = [
  { href: "/dashboard/profile", label: "Profile Settings", icon: UserCircle, pageKey: "profile" },
];

function NavItemComponent({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  icon: any;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarContent({
  user,
  permissions,
  onNavigate,
}: {
  user: SidebarProps["user"];
  permissions: Permissions;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const filteredSections = useMemo(() => {
    return allNavigationSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => permissions.pages[item.pageKey] === true
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [permissions]);

  const filteredBottom = useMemo(() => {
    return bottomNavigation.filter(
      (item) => permissions.pages[item.pageKey] === true
    );
  }, [permissions]);

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="bg-primary flex size-8 items-center justify-center rounded-lg">
          <Music className="text-primary-foreground size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Ciariguitars</span>
          <span className="text-xs text-muted-foreground">{user.role}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredSections.map((section) => (
          <div key={section.title} className="mb-4">
            <h3 className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemComponent
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href || pathname.startsWith(item.href + "/")
                  }
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="space-y-0.5">
          {filteredBottom.map((item) => (
            <NavItemComponent
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href}
              onClick={onNavigate}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between px-3">
          <div className="flex flex-col">
            <span className="truncate text-xs font-medium">{displayName}</span>
            {user.firstName && (
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ user, permissions }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-background p-2 shadow-md lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-lg lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
              <SidebarContent
                user={user}
                permissions={permissions}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <SidebarContent user={user} permissions={permissions} />
      </aside>
    </>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 animate-pulse border-r border-border bg-card lg:block">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="size-8 rounded-lg bg-muted" />
        <div className="space-y-1">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2 px-3 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-muted" />
        ))}
      </div>
    </aside>
  );
}
