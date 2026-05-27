"use client";

import { useState, useMemo, useCallback } from "react";
import { ProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderKanban,
  Users,
  ListTodo,
  Archive,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/actions";

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    tasks: number;
    members: number;
  };
}

interface ProjectsClientProps {
  projects: ProjectData[];
}

const statusConfig: Record<
  ProjectStatus,
  { label: string; color: string; icon: typeof Circle }
> = {
  ACTIVE: {
    label: "Active",
    color: "bg-success-100 text-success-700 border-success-200",
    icon: Circle,
  },
  ARCHIVED: {
    label: "Archived",
    color: "bg-secondary-100 text-secondary-600 border-secondary-200",
    icon: Archive,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-primary-100 text-primary-700 border-primary-200",
    icon: CheckCircle2,
  },
};

const statusFilterOptions = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "COMPLETED", label: "Completed" },
];

export function ProjectsClient({ projects: initialProjects }: ProjectsClientProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "ACTIVE" as ProjectStatus,
  });

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.description?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const resetForm = useCallback(() => {
    setFormData({ name: "", description: "", status: "ACTIVE" });
  }, []);

  const handleOpenCreate = useCallback(() => {
    resetForm();
    setIsCreateOpen(true);
  }, [resetForm]);

  const handleOpenEdit = useCallback((project: ProjectData) => {
    setFormData({
      name: project.name,
      description: project.description || "",
      status: project.status,
    });
    setEditingProject(project);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) return;
    setIsSubmitting(true);

    const result = await createProject({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
    });

    if (result.data) {
      setProjects((prev) => [
        {
          ...result.data!,
          description: result.data!.description ?? null,
          status: result.data!.status as ProjectStatus,
          _count: { tasks: 0, members: 0 },
        },
        ...prev,
      ]);
      setIsCreateOpen(false);
      resetForm();
    }

    setIsSubmitting(false);
  }, [formData, resetForm]);

  const handleUpdate = useCallback(async () => {
    if (!editingProject || !formData.name.trim()) return;
    setIsSubmitting(true);

    const result = await updateProject(editingProject.id, {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      status: formData.status,
    });

    if (result.data) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                name: result.data!.name,
                description: result.data!.description ?? null,
                status: result.data!.status as ProjectStatus,
              }
            : p
        )
      );
      setEditingProject(null);
      resetForm();
    }

    setIsSubmitting(false);
  }, [editingProject, formData, resetForm]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);

    const result = await deleteProject(deleteConfirm.id);
    if (result.data) {
      setProjects((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    }

    setIsSubmitting(false);
  }, [deleteConfirm]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your projects and their settings
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="size-4" />
          New Project
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FolderKanban className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            {search || statusFilter !== "ALL"
              ? "No projects match your filters"
              : "No projects yet"}
          </p>
          {!search && statusFilter === "ALL" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={handleOpenCreate}
            >
              <Plus className="size-3.5" />
              Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status];
            const StatusIcon = status.icon;
            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="group block rounded-lg border border-border bg-background p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <FolderKanban className="size-4.5 text-primary" />
                    </div>
                    <h3 className="font-semibold leading-tight">{project.name}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(project);
                        }}
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(project);
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {project.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className={status.color}>
                    <StatusIcon className="mr-1 size-3" />
                    {status.label}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {project._count.members}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ListTodo className="size-3.5" />
                    {project._count.tasks}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Add a new project to organize tasks and team members.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                placeholder="Project name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={!!editingProject}
        onOpenChange={(open) => !open && setEditingProject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project details.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                placeholder="Project name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Status</label>
              <Select
                value={formData.status}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: val as ProjectStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingProject(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;?
              This will also delete all associated tasks. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
