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
  CommandSeparator,
} from "@/components/ui/command";
import {
  ListTodo,
  Users,
  UserCircle,
  Bell,
  Repeat,
  Calculator,
  Plus,
  FolderKanban,
  Shield,
} from "lucide-react";
import { searchCommandPalette, CommandPaletteResult } from "@/lib/actions";
import type { Permissions } from "@/config/permissions";
import { useCreateTaskModalSafe } from "@/components/modals/create-task-modal-provider";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ElementType;
  section?: string;
  pageKey: string;
}

const allNavigationItems: NavigationItem[] = [
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban, section: "Work", pageKey: "projects" },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo, section: "Work", pageKey: "tasks" },
  { href: "/dashboard/recurring-tasks", label: "Recurring Tasks", icon: Repeat, section: "Work", pageKey: "recurringTasks" },
  { href: "/dashboard/calculation", label: "Calculations", icon: Calculator, section: "Tools", pageKey: "calculations" },
  { href: "/dashboard/users", label: "Users", icon: Users, section: "Admin", pageKey: "users" },
  { href: "/dashboard/roles", label: "Roles", icon: Shield, section: "Admin", pageKey: "roles" },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell, section: "Admin", pageKey: "notifications" },
  { href: "/dashboard/profile", label: "Profile Settings", icon: UserCircle, pageKey: "profile" },
];

const typeIcons: Record<CommandPaletteResult["type"], React.ElementType> = {
  task: ListTodo,
  project: FolderKanban,
  user: Users,
};

const typeLabels: Record<CommandPaletteResult["type"], string> = {
  task: "Task",
  project: "Project",
  user: "User",
};

interface CommandPaletteProps {
  permissions: Permissions;
}

export function CommandPalette({ permissions }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<CommandPaletteResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();
  const createTaskModal = useCreateTaskModalSafe();
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const navigationItems = React.useMemo(
    () => allNavigationItems.filter((item) => permissions.pages[item.pageKey] === true),
    [permissions]
  );

  const canCreateTask = permissions.resources.tasks?.create === true;

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

  React.useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const { data } = await searchCommandPalette(search);
      if (data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch("");
    router.push(href);
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setSearch("");
      setSearchResults([]);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search tasks, projects, or navigate..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? "Searching..." : "No results found."}
          </CommandEmpty>

          {searchResults.length > 0 && (
            <CommandGroup heading="Search Results">
              {searchResults.map((result) => {
                const Icon = typeIcons[result.type];
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result.href)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{result.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {typeLabels[result.type]}
                        {result.subtitle ? ` - ${result.subtitle}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {search.length < 2 && (
            <>
              {canCreateTask && (
                <CommandGroup heading="Quick Actions">
                  {createTaskModal && (
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        createTaskModal.openCreateTaskModal();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Plus className="size-4 text-muted-foreground" />
                      <span>Create Task</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              )}

              <CommandSeparator />

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
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
