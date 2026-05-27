"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProjectStatus, TaskStatus, TaskPriority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Users,
  ListTodo,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  Circle,
  Archive,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
} from "@/lib/actions";

interface MemberUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface ProjectMember {
  id: string;
  userId: string;
  user: MemberUser;
  createdAt: Date;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  members: ProjectMember[];
  _count: { tasks: number };
  createdAt: Date;
  updatedAt: Date;
}

interface TaskData {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignee: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  project: { id: string; name: string };
}

interface AssignableUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface ProjectDetailClientProps {
  project: ProjectData;
  tasks: TaskData[];
  allUsers: AssignableUser[];
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

const taskStatusConfig: Record<TaskStatus, { label: string; color: string }> = {
  PENDING_ADMIN_REVIEW: { label: "Pending Review", color: "bg-warning-100 text-warning-700 border-warning-200" },
  TODO: { label: "To Do", color: "bg-secondary-100 text-secondary-700 border-secondary-200" },
  IN_PROGRESS: { label: "In Progress", color: "bg-info-100 text-info-700 border-info-200" },
  BLOCKED: { label: "Blocked", color: "bg-danger-100 text-danger-700 border-danger-200" },
  DONE: { label: "Done", color: "bg-success-100 text-success-700 border-success-200" },
};

const priorityConfig: Record<TaskPriority, { label: string; icon: typeof Circle; color: string }> = {
  URGENT: { label: "Urgent", icon: AlertCircle, color: "text-danger-600" },
  HIGH: { label: "High", icon: AlertCircle, color: "text-warning-600" },
  MEDIUM: { label: "Medium", icon: Clock, color: "text-warning-500" },
  LOW: { label: "Low", icon: Circle, color: "text-secondary-500" },
};

export function ProjectDetailClient({
  project: initialProject,
  tasks: initialTasks,
  allUsers,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [tasks] = useState(initialTasks);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    status: project.status,
  });

  const availableUsers = useMemo(() => {
    const memberIds = new Set(project.members.map((m) => m.userId));
    return allUsers.filter((u) => !memberIds.has(u.id));
  }, [allUsers, project.members]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
    return { total, done, inProgress, blocked };
  }, [tasks]);

  const handleUpdate = useCallback(async () => {
    if (!formData.name.trim()) return;
    setIsSubmitting(true);

    const result = await updateProject(project.id, {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      status: formData.status,
    });

    if (result.data) {
      setProject((prev) => ({
        ...prev,
        name: result.data!.name,
        description: result.data!.description ?? null,
        status: result.data!.status as ProjectStatus,
      }));
      setIsEditOpen(false);
    }

    setIsSubmitting(false);
  }, [project.id, formData]);

  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);
    const result = await deleteProject(project.id);
    if (result.data) {
      router.push("/dashboard/projects");
    }
    setIsSubmitting(false);
  }, [project.id, router]);

  const handleAddMember = useCallback(async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);

    const result = await addProjectMember(project.id, selectedUserId);
    if (result.data) {
      const addedUser = allUsers.find((u) => u.id === selectedUserId);
      if (addedUser) {
        setProject((prev) => ({
          ...prev,
          members: [
            ...prev.members,
            {
              id: result.data!.id,
              userId: addedUser.id,
              user: {
                id: addedUser.id,
                email: addedUser.email,
                firstName: addedUser.firstName,
                lastName: addedUser.lastName,
                role: addedUser.role,
              },
              createdAt: new Date(),
            },
          ],
        }));
      }
      setSelectedUserId("");
      setIsAddMemberOpen(false);
    }

    setIsSubmitting(false);
  }, [project.id, selectedUserId, allUsers]);

  const handleRemoveMember = useCallback(async () => {
    if (!removingMember) return;
    setIsSubmitting(true);

    const result = await removeProjectMember(project.id, removingMember.userId);
    if (result.data) {
      setProject((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== removingMember.id),
      }));
      setRemovingMember(null);
    }

    setIsSubmitting(false);
  }, [project.id, removingMember]);

  const status = statusConfig[project.status];
  const StatusIcon = status.icon;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/projects"
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              <Badge variant="outline" className={status.color}>
                <StatusIcon className="mr-1 size-3" />
                {status.label}
              </Badge>
            </div>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setFormData({
                  name: project.name,
                  description: project.description || "",
                  status: project.status,
                });
                setIsEditOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Tasks", value: taskStats.total, icon: ListTodo },
          { label: "Done", value: taskStats.done, icon: CheckCircle2 },
          { label: "In Progress", value: taskStats.inProgress, icon: Clock },
          { label: "Blocked", value: taskStats.blocked, icon: AlertCircle },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <stat.icon className="size-4" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tasks */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Tasks</h2>
              <span className="text-xs text-muted-foreground">
                {tasks.length} total
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="py-12 text-center">
                <ListTodo className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No tasks in this project yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  asChild
                >
                  <Link href="/dashboard/tasks">
                    <Plus className="size-3.5" />
                    Go to Tasks
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((task) => {
                  const taskStatus = taskStatusConfig[task.status];
                  const priority = priorityConfig[task.priority];
                  const PriorityIcon = priority.icon;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/30"
                    >
                      <PriorityIcon
                        className={`size-4 shrink-0 ${priority.color}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {task.name}
                        </p>
                        {task.assignee && (
                          <p className="truncate text-xs text-muted-foreground">
                            {task.assignee.firstName || task.assignee.email}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ${taskStatus.color}`}
                      >
                        {taskStatus.label}
                      </Badge>
                      {task.dueDate && (
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        asChild
                      >
                        <Link href={`/dashboard/tasks?highlight=${task.id}`}>
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Members */}
        <div>
          <div className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Members</h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIsAddMemberOpen(true)}
              >
                <UserPlus className="size-4" />
              </Button>
            </div>

            {project.members.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No members yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => setIsAddMemberOpen(true)}
                >
                  <UserPlus className="size-3.5" />
                  Add Member
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {project.members.map((member) => {
                  const displayName =
                    member.user.firstName && member.user.lastName
                      ? `${member.user.firstName} ${member.user.lastName}`
                      : member.user.email;
                  const initials = member.user.firstName
                    ? member.user.firstName[0].toUpperCase()
                    : member.user.email[0].toUpperCase();

                  return (
                    <div
                      key={member.id}
                      className="group flex items-center gap-3 px-5 py-3"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.user.role}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => setRemovingMember(member)}
                      >
                        <UserMinus className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project details.</DialogDescription>
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
              onClick={() => setIsEditOpen(false)}
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

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This
              will also delete all associated tasks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
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

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Add a team member to this project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All assignable users are already members of this project.
              </p>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName
                        ? `${user.firstName} ${user.lastName || ""}`
                        : user.email}{" "}
                      ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddMemberOpen(false);
                setSelectedUserId("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={isSubmitting || !selectedUserId}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              {removingMember?.user.firstName || removingMember?.user.email} from
              this project?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemovingMember(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
