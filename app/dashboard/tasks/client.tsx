"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  User,
  Building2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Circle,
  Ban,
  X,
  Paperclip,
  FileText,
  Image,
  Video,
  Loader2,
  ExternalLink,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { createTask, updateTask, deleteTask, deleteAttachment, createTaskView, updateTaskView, deleteTaskView, TaskViewData } from "@/lib/actions";
import { DataTable, ColumnDef, ViewData, FilterState } from "@/components/data-table";
import { toast } from "sonner";

// ============================================
// Type Definitions
// ============================================

interface BlockerData {
  id: string;
  name: string;
  status: TaskStatus;
}

interface AttachmentData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface MeetingData {
  id: string;
  title: string;
  projectId: string | null;
}

interface TaskData {
  id: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  projectId: string;
  project: {
    id: string;
    name: string;
  };
  assigneeId: string | null;
  assignee: {
    id: string;
    email: string;
  } | null;
  blockedByTasks?: BlockerData[];
  attachments?: AttachmentData[];
  createdById?: string | null;
  createdBy?: {
    id: string;
    email: string;
    firstName: string | null;
  } | null;
  meetingId?: string | null;
  meeting?: MeetingData | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectData {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED" | "COMPLETED";
  description: string | null;
  _count: {
    members: number;
    tasks: number;
  };
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  role: string;
}

interface TasksClientProps {
  tasks: TaskData[];
  projects: ProjectData[];
  users: UserData[];
  savedViews: TaskViewData[];
}

// ============================================
// Config
// ============================================

const priorityConfig = {
  URGENT: { label: "Urgent", color: "bg-danger-100 text-danger-700 border-danger-200", icon: AlertCircle },
  HIGH: { label: "High", color: "bg-warning-100 text-warning-700 border-warning-200", icon: AlertCircle },
  MEDIUM: { label: "Medium", color: "bg-warning-50 text-warning-600 border-warning-100", icon: Clock },
  LOW: { label: "Low", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
};

const statusConfig = {
  PENDING_ADMIN_REVIEW: { label: "Pending Review", color: "bg-warning-100 text-warning-700 border-warning-200", icon: Eye },
  TODO: { label: "Todo", color: "bg-secondary-100 text-secondary-600 border-secondary-200", icon: Circle },
  IN_PROGRESS: { label: "In Progress", color: "bg-primary-100 text-primary-700 border-primary-200", icon: Clock },
  BLOCKED: { label: "Blocked", color: "bg-danger-100 text-danger-700 border-danger-200", icon: Ban },
  DONE: { label: "Done", color: "bg-success-100 text-success-700 border-success-200", icon: CheckCircle2 },
};

// ============================================
// Main Component
// ============================================

export function TasksClient({ tasks: initialTasks, projects, users, savedViews: initialSavedViews }: TasksClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const purchasedProjects = useMemo(
    () => projects.filter((c) => c.status === "ACTIVE"),
    [projects]
  );

  const highlightParam = searchParams?.get("highlight");
  const highlightIds = useMemo(() => highlightParam ? highlightParam.split(",") : [], [highlightParam]);

  const statusParam = searchParams?.get("status");
  const urlFilters = useMemo(() => {
    if (statusParam) {
      const statuses = statusParam.split(",");
      return { status: statuses };
    }
    return undefined;
  }, [statusParam]);

  const [tasks, setTasks] = useState<TaskData[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [blockerSearchQuery, setBlockerSearchQuery] = useState("");

  const handledHighlightRef = useRef<string | null>(null);

  const [savedViews, setSavedViews] = useState<TaskViewData[]>(initialSavedViews);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newAttachments, setNewAttachments] = useState<Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>>([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [previewAttachment, setPreviewAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    status: "TODO" as TaskStatus,
    dueDate: "",
    projectId: "",
    assigneeId: "",
    blockedByTaskIds: [] as string[],
  });

  // ============================================
  // Column Definitions for DataTable
  // ============================================

  const columns: ColumnDef<TaskData>[] = useMemo(() => [
    {
      id: "name",
      header: "Task",
      accessorKey: "name",
      width: "w-2/5",
      sortable: true,
      cell: (row) => (
        <p className="text-text-dark truncate font-medium">{row.name}</p>
      ),
    },
    {
      id: "project",
      header: "Project",
      accessorKey: "project.name",
      width: "w-40",
      sortable: true,
      sortFn: (a, b, direction) => {
        const comparison = a.project.name.localeCompare(b.project.name);
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: projects.map((c) => ({ value: c.id, label: c.name })),
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        return Array.isArray(value) && value.includes(row.projectId);
      },
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="size-4 shrink-0 text-text-secondary" />
          <span className="truncate text-sm">{row.project.name}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { PENDING_ADMIN_REVIEW: -1, TODO: 0, IN_PROGRESS: 1, BLOCKED: 2, DONE: 3 };
        const comparison = order[a.status] - order[b.status];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => ({
        value: s,
        label: statusConfig[s].label,
        icon: statusConfig[s].icon,
      })),
      cell: (row) => {
        const StatusIcon = statusConfig[row.status].icon;
        return (
          <Badge className={`${statusConfig[row.status].color} whitespace-nowrap border`}>
            <StatusIcon className="mr-1 size-3" />
            {statusConfig[row.status].label}
          </Badge>
        );
      },
    },
    {
      id: "priority",
      header: "Priority",
      accessorKey: "priority",
      sortable: true,
      sortFn: (a, b, direction) => {
        const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const comparison = order[a.priority] - order[b.priority];
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: (["URGENT", "HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((p) => ({
        value: p,
        label: priorityConfig[p].label,
        icon: priorityConfig[p].icon,
      })),
      cell: (row) => {
        const PriorityIcon = priorityConfig[row.priority].icon;
        return (
          <Badge className={`${priorityConfig[row.priority].color} whitespace-nowrap border`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[row.priority].label}
          </Badge>
        );
      },
    },
    {
      id: "assignee",
      header: "Assignee",
      accessorKey: "assignee.email",
      sortable: true,
      sortFn: (a, b, direction) => {
        const aEmail = a.assignee?.email || "";
        const bEmail = b.assignee?.email || "";
        const comparison = aEmail.localeCompare(bEmail);
        return direction === "asc" ? comparison : -comparison;
      },
      filterable: true,
      filterType: "multi-select",
      filterOptions: [
        { value: "unassigned", label: "Unassigned" },
        ...users.map((u) => ({ value: u.id, label: u.firstName || u.email })),
      ],
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        if (Array.isArray(value)) {
          if (value.includes("unassigned") && !row.assigneeId) return true;
          if (row.assigneeId && value.includes(row.assigneeId)) return true;
        }
        return false;
      },
      cell: (row) => (
        row.assignee ? (
          <div className="flex max-w-[180px] items-center gap-2">
            <User className="size-4 shrink-0 text-text-secondary" />
            <span className="truncate text-sm">{row.assignee.email}</span>
          </div>
        ) : (
          <span className="text-sm text-text-secondary">Unassigned</span>
        )
      ),
    },
    {
      id: "createdBy",
      header: "Created By",
      accessorKey: "createdById",
      filterable: true,
      filterType: "multi-select",
      filterOptions: users.map((u) => ({ value: u.id, label: u.firstName || u.email })),
      filterFn: (row, value) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true;
        if (Array.isArray(value)) {
          if (row.createdById && value.includes(row.createdById)) return true;
        }
        return false;
      },
      showInBoard: false,
      cell: () => null,
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessorKey: "dueDate",
      sortable: true,
      sortFn: (a, b, direction) => {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        const comparison = aDate - bDate;
        return direction === "asc" ? comparison : -comparison;
      },
      cell: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Calendar className="size-4 shrink-0 text-text-secondary" />
          <span className="text-sm">{formatDate(row.dueDate)}</span>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      sortable: true,
      sortFn: (a, b, direction) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        const comparison = aDate - bDate;
        return direction === "asc" ? comparison : -comparison;
      },
      cell: (row) => (
        <span className="whitespace-nowrap text-sm text-text-secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ], [projects, users]);

  // ============================================
  // Handlers
  // ============================================

  const handleEditTask = useCallback((task: TaskData) => {
    setSelectedTask(task);
    setFormData({
      name: task.name,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      projectId: task.projectId,
      assigneeId: task.assigneeId || "",
      blockedByTaskIds: task.blockedByTasks?.map((t) => t.id) || [],
    });
    setNewAttachments([]);
    setAttachmentsToDelete([]);
    setUploadError(null);
    setIsEditModalOpen(true);
  }, []);

  useEffect(() => {
    if (highlightIds.length > 0) {
      const highlightKey = highlightIds.join(",");
      
      if (handledHighlightRef.current !== highlightKey) {
        handledHighlightRef.current = highlightKey;
        
        const highlightedTask = tasks.find((t) => highlightIds.includes(t.id));
        if (highlightedTask) {
          handleEditTask(highlightedTask);
        }
      }
    } else {
      handledHighlightRef.current = null;
    }
  }, [highlightIds, tasks, handleEditTask]);

  const handleClearHighlight = useCallback(() => {
    router.replace("/dashboard/tasks", { scroll: false });
  }, [router]);

  const handleCreateTask = () => {
    setFormData({
      name: "",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "",
      projectId: purchasedProjects[0]?.id || "",
      assigneeId: "",
      blockedByTaskIds: [],
    });
    setNewAttachments([]);
    setUploadError(null);
    setIsCreateModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 250MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("context", "task");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      setNewAttachments((prev) => [...prev, {
        name: result.name,
        url: result.url,
        type: result.type,
        size: result.size,
      }]);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveNewAttachment = (index: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMarkAttachmentForDeletion = (attachmentId: string) => {
    setAttachmentsToDelete((prev) => [...prev, attachmentId]);
  };

  const handleDeleteTask = (task: TaskData) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmitCreate = async () => {
    if (!formData.name || !formData.projectId) return;

    const hasBlockers = formData.blockedByTaskIds.length > 0;
    const effectiveStatus = hasBlockers ? "BLOCKED" : formData.status;

    const taskId = createId();
    const project = purchasedProjects.find((c) => c.id === formData.projectId);
    const assignee = formData.assigneeId ? users.find((u) => u.id === formData.assigneeId) : null;

    const blockedByTasksData = formData.blockedByTaskIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is TaskData => t !== undefined)
      .map((t) => ({ id: t.id, name: t.name, status: t.status }));

    const optimisticAttachments = newAttachments.map((att) => ({
      id: createId(),
      name: att.name,
      url: att.url,
      type: att.type,
      size: att.size,
    }));

    const optimisticTask: TaskData = {
      id: taskId,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      status: effectiveStatus,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      projectId: formData.projectId,
      project: {
        id: project?.id || "",
        name: project?.name || "",
      },
      assigneeId: formData.assigneeId || null,
      assignee: assignee ? { id: assignee.id, email: assignee.email } : null,
      blockedByTasks: blockedByTasksData,
      attachments: optimisticAttachments,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setTasks((prev) => [optimisticTask, ...prev]);
    setIsCreateModalOpen(false);

    try {
      const result = await createTask({
        id: taskId,
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        status: effectiveStatus,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        projectId: formData.projectId,
        assigneeId: formData.assigneeId || undefined,
        blockedByTaskIds: formData.blockedByTaskIds,
        attachments: newAttachments.length > 0 ? newAttachments : undefined,
      });

      if (result.error) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        alert(result.error);
      } else if (result.data) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? result.data : t)));
      }
      setNewAttachments([]);
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      alert("Failed to create task");
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedTask || !formData.name || !formData.projectId) return;

    const hasBlockers = formData.blockedByTaskIds.length > 0;
    const effectiveStatus = hasBlockers ? "BLOCKED" : formData.status;

    const project = purchasedProjects.find((c) => c.id === formData.projectId);
    const assignee = formData.assigneeId ? users.find((u) => u.id === formData.assigneeId) : null;

    const blockedByTasksData = formData.blockedByTaskIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is TaskData => t !== undefined)
      .map((t) => ({ id: t.id, name: t.name, status: t.status }));

    const previousTasks = [...tasks];

    const optimisticNewAttachments = newAttachments.map((att) => ({
      id: createId(),
      name: att.name,
      url: att.url,
      type: att.type,
      size: att.size,
    }));

    const remainingAttachments = (selectedTask.attachments || []).filter(
      (a) => !attachmentsToDelete.includes(a.id)
    );
    const combinedAttachments = [
      ...remainingAttachments,
      ...optimisticNewAttachments,
    ];

    const optimisticTask: TaskData = {
      ...selectedTask,
      name: formData.name,
      description: formData.description || null,
      priority: formData.priority,
      status: effectiveStatus,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      projectId: formData.projectId,
      project: {
        id: project?.id || "",
        name: project?.name || "",
      },
      assigneeId: formData.assigneeId || null,
      assignee: assignee ? { id: assignee.id, email: assignee.email } : null,
      blockedByTasks: blockedByTasksData,
      attachments: combinedAttachments,
      updatedAt: new Date(),
    };

    const attachmentsToDeleteNow = [...attachmentsToDelete];

    setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? optimisticTask : t)));
    setIsEditModalOpen(false);
    setSelectedTask(null);

    try {
      for (const attachmentId of attachmentsToDeleteNow) {
        await deleteAttachment(attachmentId);
      }

      const result = await updateTask(selectedTask.id, {
        name: formData.name,
        description: formData.description || undefined,
        priority: formData.priority,
        status: effectiveStatus,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        projectId: formData.projectId,
        assigneeId: formData.assigneeId || null,
        blockedByTaskIds: formData.blockedByTaskIds,
        newAttachments: newAttachments.length > 0 ? newAttachments : undefined,
      });
      setNewAttachments([]);
      setAttachmentsToDelete([]);

      if (result.error) {
        setTasks(previousTasks);
        alert(result.error);
      } else if (result.data) {
        setTasks((prev) =>
          prev.map((t) => (t.id === selectedTask.id ? result.data : t))
        );
      }
    } catch {
      setTasks(previousTasks);
      alert("Failed to update task");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedTask) return;

    const previousTasks = [...tasks];

    setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
    setIsDeleteDialogOpen(false);
    const taskToDelete = selectedTask;
    setSelectedTask(null);

    try {
      const result = await deleteTask(taskToDelete.id);
      if (result.error) {
        setTasks(previousTasks);
        alert(result.error);
      }
    } catch {
      setTasks(previousTasks);
      alert("Failed to delete task");
    }
  };

  // ============================================
  // View Management
  // ============================================

  const convertedViews: ViewData[] = useMemo(() => {
    return savedViews.map((view) => ({
      id: view.id,
      name: view.name,
      viewMode: view.viewMode as "table" | "board",
      sortColumn: view.sortColumn,
      sortDirection: view.sortDirection as "asc" | "desc",
      filters: {
        status: view.statusFilters,
        priority: view.priorityFilters,
        project: view.projectFilters,
        assignee: view.assigneeFilters,
        createdBy: view.createdByFilters || [],
      },
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    }));
  }, [savedViews]);

  const handleSaveView = async (view: Omit<ViewData, "id" | "createdAt" | "updatedAt">) => {
    const result = await createTaskView({
      name: view.name,
      viewMode: view.viewMode,
      sortColumn: view.sortColumn,
      sortDirection: view.sortDirection,
      statusFilters: (view.filters.status as string[]) || [],
      priorityFilters: (view.filters.priority as string[]) || [],
      projectFilters: (view.filters.project as string[]) || [],
      assigneeFilters: (view.filters.assignee as string[]) || [],
      createdByFilters: (view.filters.createdBy as string[]) || [],
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      setSavedViews((prev) => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleUpdateView = async (id: string, data: Partial<ViewData>) => {
    const result = await updateTaskView(id, { name: data.name });
    if (result.data) {
      setSavedViews((prev) =>
        prev
          .map((v) => (v.id === id ? { ...v, name: data.name || v.name } : v))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  };

  const handleDeleteView = async (id: string) => {
    const result = await deleteTaskView(id);
    if (result.data) {
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    }
  };

  // ============================================
  // Render Actions
  // ============================================

  const renderActions = useCallback((task: TaskData) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleEditTask(task);
          }}
        >
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task);
          }}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), [handleEditTask]);

  // ============================================
  // Board View Card Renderer
  // ============================================

  const renderBoardCard = useCallback((task: TaskData) => {
    const PriorityIcon = priorityConfig[task.priority].icon;
    return (
      <>
        <div className="mb-2 flex items-start justify-between">
          <p className="text-text-dark font-medium">{task.name}</p>
          <Badge className={`${priorityConfig[task.priority].color} border text-xs`}>
            <PriorityIcon className="mr-1 size-3" />
            {priorityConfig[task.priority].label}
          </Badge>
        </div>
        {task.description && (
          <p className="mb-2 line-clamp-2 text-sm text-text-secondary">
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Building2 className="size-3" />
            {task.project.name}
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(task.dueDate)}
            </div>
          )}
        </div>
        {task.assignee && (
          <div className="mt-2 flex items-center gap-1 text-xs text-text-secondary">
            <User className="size-3" />
            {task.assignee.email}
          </div>
        )}
      </>
    );
  }, []);

  // ============================================
  // Custom Search Function
  // ============================================

  const searchFn = useCallback((task: TaskData, query: string) => {
    const q = query.toLowerCase();
    return (
      task.name.toLowerCase().includes(q) ||
      task.project.name.toLowerCase().includes(q) ||
      (task.assignee?.email.toLowerCase().includes(q) ?? false)
    );
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-text-dark text-2xl font-bold">Tasks</h1>
          <p className="text-text-secondary">Manage project tasks and assignments</p>
        </div>
        <Button onClick={handleCreateTask}>
          <Plus className="mr-2 size-4" />
          New Task
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={tasks}
        columns={columns}
        storageKey="admin-tasks"
        searchable
        searchPlaceholder="Search tasks..."
        searchFn={searchFn}
        enableBoardView
        boardGroupBy="status"
        boardGroupConfig={{
          TODO: { label: "Todo", icon: Circle },
          IN_PROGRESS: { label: "In Progress", icon: Clock },
          BLOCKED: { label: "Blocked", icon: Ban },
          DONE: { label: "Done", icon: CheckCircle2 },
        }}
        boardGroupOrder={["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]}
        renderBoardCard={renderBoardCard}
        savedViews={convertedViews}
        onSaveView={handleSaveView}
        onUpdateView={handleUpdateView}
        onDeleteView={handleDeleteView}
        getRowId={(task) => task.id}
        onRowClick={handleEditTask}
        highlightIds={highlightIds}
        onHighlightClear={handleClearHighlight}
        renderActions={renderActions}
        pageSize={25}
        emptyMessage="No tasks yet. Create your first task."
        emptyFilteredMessage="No tasks found matching your search or filters."
        defaultSort={{ column: "createdAt", direction: "desc" }}
        urlFilters={urlFilters}
      />

      {/* Create/Edit Task Modal */}
      <Dialog
        open={isCreateModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent className="flex min-h-[624px] max-w-2xl flex-col p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-text-secondary" />
              <span className="text-sm text-text-secondary">
                {purchasedProjects.find((c) => c.id === formData.projectId)?.name || "Select project"}
              </span>
              <span className="text-text-secondary">&rsaquo;</span>
              <span className="text-sm font-medium">
                {isCreateModalOpen ? "New task" : "Edit task"}
              </span>
            </div>
            {isEditModalOpen && selectedTask?.meeting && (
              <div className="flex items-center gap-3">
                <Link
                  href={`/dashboard/clients/${selectedTask.meeting.projectId}?meeting=${selectedTask.meeting.id}`}
                  className="flex items-center gap-1.5 text-xs text-secondary-600 hover:text-primary-600"
                  onClick={() => {
                    setIsEditModalOpen(false);
                  }}
                >
                  <Video className="size-3.5" />
                  From: {selectedTask.meeting.title}
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Title & Description */}
          <div className="flex flex-1 flex-col px-4">
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Task title"
              className="border-0 px-0 text-xl font-medium shadow-none focus-visible:ring-0"
            />
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add description..."
              className="mt-2 flex-1 resize-none border-0 px-0 text-text-secondary shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Properties Row */}
          <div className="flex flex-wrap items-center gap-2 p-4">
            {/* Status */}
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                {(() => {
                  const StatusIcon = statusConfig[formData.status].icon;
                  return <StatusIcon className="size-4" />;
                })()}
                <span className="text-sm">{statusConfig[formData.status].label}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">
                  <div className="flex items-center gap-2">
                    <Circle className="size-4" />
                    Todo
                  </div>
                </SelectItem>
                <SelectItem value="IN_PROGRESS">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    In Progress
                  </div>
                </SelectItem>
                <SelectItem value="BLOCKED">
                  <div className="flex items-center gap-2">
                    <Ban className="size-4" />
                    Blocked
                  </div>
                </SelectItem>
                <SelectItem value="DONE">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    Done
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Priority */}
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                {(() => {
                  const PriorityIcon = priorityConfig[formData.priority].icon;
                  return (
                    <>
                      <PriorityIcon className="size-4" />
                      <span className="text-sm">{priorityConfig[formData.priority].label}</span>
                    </>
                  );
                })()}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URGENT">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    Urgent
                  </div>
                </SelectItem>
                <SelectItem value="HIGH">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    High
                  </div>
                </SelectItem>
                <SelectItem value="MEDIUM">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    Medium
                  </div>
                </SelectItem>
                <SelectItem value="LOW">
                  <div className="flex items-center gap-2">
                    <Circle className="size-4" />
                    Low
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Assignee */}
            <Select
              value={formData.assigneeId || "unassigned"}
              onValueChange={(value) =>
                setFormData({ ...formData, assigneeId: value === "unassigned" ? "" : value })
              }
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                <User className="size-4 text-text-secondary" />
                <span className="text-sm">
                  {formData.assigneeId
                    ? (() => {
                      const user = users.find((u) => u.id === formData.assigneeId);
                      return user?.firstName || user?.email || "Assignee";
                    })()
                    : "Assignee"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Project */}
            <Select
              value={formData.projectId}
              onValueChange={(value) => setFormData({ ...formData, projectId: value })}
            >
              <SelectTrigger className="h-8 w-auto gap-2 rounded-full border-border bg-background px-3">
                <Building2 className="size-4 text-text-secondary" />
                <span className="text-sm">
                  {formData.projectId
                    ? purchasedProjects.find((c) => c.id === formData.projectId)?.name || "Project"
                    : "Project"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {purchasedProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Due Date */}
            <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3">
              <Calendar className="size-4 text-text-secondary" />
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="border-0 bg-transparent text-sm outline-none"
              />
            </div>

            {/* Blocked By */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => setIsBlockerModalOpen(true)}
            >
              <Ban className="size-4 text-text-secondary" />
              <span className="text-sm">
                {formData.blockedByTaskIds.length > 0
                  ? `Blocked by ${formData.blockedByTaskIds.length}`
                  : "Add blocker"}
              </span>
            </Button>

            {/* Attachments */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/png,image/jpeg,video/mp4"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin text-text-secondary" />
              ) : (
                <Paperclip className="size-4 text-text-secondary" />
              )}
              <span className="text-sm">
                {isUploading ? "Uploading..." : "Attach file"}
              </span>
            </Button>
          </div>

          {/* Attachments Section */}
          {((isEditModalOpen && selectedTask?.attachments && selectedTask.attachments.filter(a => !attachmentsToDelete.includes(a.id)).length > 0) || newAttachments.length > 0) && (
            <div className="space-y-2 px-4 pb-2">
              <p className="text-sm font-medium text-text-secondary">Attachments</p>
              <div className="flex flex-wrap gap-3">
                {isEditModalOpen && selectedTask?.attachments?.filter(a => !attachmentsToDelete.includes(a.id)).map((attachment) => {
                  const isVideo = attachment.type.startsWith("video/");
                  const isImage = attachment.type.startsWith("image/");
                  return (
                    <div
                      key={attachment.id}
                      className="group relative"
                    >
                      <div
                        onClick={() => setPreviewAttachment({
                          url: attachment.url,
                          type: attachment.type,
                          name: attachment.name,
                        })}
                        className="relative size-20 cursor-pointer overflow-hidden rounded-lg border border-border bg-background-secondary transition-all hover:border-primary-400 hover:shadow-md"
                      >
                        {isImage ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="size-full object-cover"
                          />
                        ) : isVideo ? (
                          <div className="flex size-full items-center justify-center bg-secondary-100">
                            <Video className="size-8 text-secondary-500" />
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMarkAttachmentForDeletion(attachment.id);
                        }}
                        className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-danger-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
                {newAttachments.map((attachment, index) => {
                  const isVideo = attachment.type.startsWith("video/");
                  const isImage = attachment.type.startsWith("image/");
                  return (
                    <div
                      key={`new-${index}`}
                      className="group relative"
                    >
                      <div
                        onClick={() => setPreviewAttachment({
                          url: attachment.url,
                          type: attachment.type,
                          name: attachment.name,
                        })}
                        className="relative size-20 cursor-pointer overflow-hidden rounded-lg border-2 border-success-400 bg-background-secondary transition-all hover:border-success-500 hover:shadow-md"
                      >
                        {isImage ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="size-full object-cover"
                          />
                        ) : isVideo ? (
                          <div className="flex size-full items-center justify-center bg-success-50">
                            <Video className="size-8 text-success-500" />
                          </div>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-success-500 px-1 py-0.5 text-center text-[10px] text-white">
                          New
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveNewAttachment(index);
                        }}
                        className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-danger-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="mx-4 mb-2 text-sm text-danger-600">{uploadError}</div>
          )}

          {/* BLOCKED status warning */}
          {formData.status === "BLOCKED" && formData.blockedByTaskIds.length === 0 && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              <Ban className="size-4" />
              <span>Please select at least one blocker when status is set to Blocked.</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isCreateModalOpen ? handleSubmitCreate : handleSubmitEdit}
              disabled={
                !formData.name || 
                !formData.projectId || 
                isUploading ||
                (formData.status === "BLOCKED" && formData.blockedByTaskIds.length === 0)
              }
            >
              {isCreateModalOpen ? "Create task" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedTask?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleConfirmDelete} variant="destructive">
              Delete
            </Button>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocker Selection Modal */}
      <Dialog open={isBlockerModalOpen} onOpenChange={(open) => {
        setIsBlockerModalOpen(open);
        if (!open) setBlockerSearchQuery("");
      }}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Select Blockers</DialogTitle>
            <DialogDescription>
              Select tasks that block this task from being completed.
            </DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search tasks..."
              value={blockerSearchQuery}
              onChange={(e) => setBlockerSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {/* Tasks Section */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-text-secondary">Tasks</h4>
              <div className="space-y-1">
                {tasks
                  .filter((t) =>
                    t.name.toLowerCase().includes(blockerSearchQuery.toLowerCase()) &&
                      t.id !== selectedTask?.id &&
                      t.status !== "DONE"
                  )
                  .sort((a, b) => {
                    const aSelected = formData.blockedByTaskIds.includes(a.id);
                    const bSelected = formData.blockedByTaskIds.includes(b.id);
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;
                    return 0;
                  })
                  .slice(0, 10)
                  .map((task) => {
                    const isSelected = formData.blockedByTaskIds.includes(task.id);
                    const StatusIcon = statusConfig[task.status].icon;
                    return (
                      <div
                        key={task.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${
                            isSelected
                              ? "border border-primary-200 bg-primary-50"
                              : "hover:bg-secondary-50"
                          }`}
                        onClick={() => {
                          if (isSelected) {
                            setFormData({
                              ...formData,
                              blockedByTaskIds: formData.blockedByTaskIds.filter(
                                (id) => id !== task.id
                              ),
                            });
                          } else {
                            setFormData({
                              ...formData,
                              blockedByTaskIds: [...formData.blockedByTaskIds, task.id],
                            });
                          }
                        }}
                      >
                        <StatusIcon className="size-4 text-text-secondary" />
                        <div className="flex-1 truncate">
                          <p className="truncate text-sm font-medium">{task.name}</p>
                          <p className="text-xs text-text-secondary">
                            {task.project.name}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="size-4 text-primary-600" />}
                      </div>
                    );
                  })}
                {tasks.filter(
                  (t) =>
                    t.name.toLowerCase().includes(blockerSearchQuery.toLowerCase()) &&
                      t.id !== selectedTask?.id &&
                      t.status !== "DONE"
                ).length === 0 && (
                  <p className="py-2 text-center text-sm text-text-secondary">
                      No tasks found
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button
              onClick={() => {
                setIsBlockerModalOpen(false);
                setBlockerSearchQuery("");
              }}
            >
              Done
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsBlockerModalOpen(false);
                setBlockerSearchQuery("");
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewAttachment?.name || "Attachment Preview"}</DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="relative">
              <button
                onClick={() => setPreviewAttachment(null)}
                className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
              
              {previewAttachment.type.startsWith("image/") && (
                <div className="flex max-h-[85vh] items-center justify-center bg-black p-4">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[80vh] max-w-full object-contain"
                  />
                </div>
              )}
              
              {previewAttachment.type.startsWith("video/") && (
                <div className="flex max-h-[85vh] items-center justify-center bg-black p-4">
                  <video
                    src={previewAttachment.url}
                    controls
                    autoPlay
                    className="max-h-[80vh] max-w-full"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              <div className="border-t border-border bg-background px-4 py-3">
                <p className="text-sm text-text-secondary">{previewAttachment.name}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Utilities
// ============================================

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
