"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UserRole, TaskPriority } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import prisma from "@/lib/prisma";
import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { requirePermission } from "@/lib/permissions";

// ============================================
// UTILITY
// ============================================

async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function revalidatePathClient(path: string) {
  revalidatePath(path, "layout");
}

// ============================================
// PROJECT ACTIONS
// ============================================

export async function createProject(data: { name: string; description?: string }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "projects", "create");
    if (!perm.allowed) return { data: null, error: perm.error };

    console.log("[Projects] Creating project:", data.name);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    return { data: project, error: null };
  } catch (error) {
    console.error("Error creating project:", error);
    return { data: null, error: "Failed to create project" };
  }
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string; status?: "ACTIVE" | "ARCHIVED" | "COMPLETED" }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "projects", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    console.log("[Projects] Updating project:", id);

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    return { data: project, error: null };
  } catch (error) {
    console.error("Error updating project:", error);
    return { data: null, error: "Failed to update project" };
  }
}

export async function deleteProject(id: string) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "projects", "delete");
    if (!perm.allowed) return { data: null, error: perm.error };

    console.log("[Projects] Deleting project:", id);

    await prisma.project.delete({
      where: { id },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting project:", error);
    return { data: null, error: "Failed to delete project" };
  }
}

export async function addProjectMember(projectId: string, userId: string) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(currentUserId, "projects", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    const member = await prisma.projectMember.create({
      data: { projectId, userId },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    return { data: member, error: null };
  } catch (error) {
    console.error("Error adding project member:", error);
    return { data: null, error: "Failed to add project member" };
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(currentUserId, "projects", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    await prisma.projectMember.delete({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/projects");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error removing project member:", error);
    return { data: null, error: "Failed to remove project member" };
  }
}

// ============================================
// CALCULATION ACTIONS
// ============================================

export async function updateCalculation(
  id: string,
  data: { name: string; description?: string; flowData?: any }
) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  return prisma.calculation.update({
    where: { id },
    data,
  });
}

export async function deleteCalculation(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  return prisma.calculation.delete({
    where: { id },
  });
}

export async function cloneCalculation(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");

  const originalCalculation = await prisma.calculation.findUnique({
    where: { id },
  });

  if (!originalCalculation) throw new Error("Calculation not found");

  return prisma.calculation.create({
    data: {
      name: `(Copy) ${originalCalculation.name}`,
      description: originalCalculation.description,
      flowData: originalCalculation.flowData as any,
      userId: originalCalculation.userId,
    },
  });
}

// ============================================
// USER ACTIONS
// ============================================

export async function createUser(data: { email: string; role?: UserRole }) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(currentUserId, "users", "create");
    if (!perm.allowed) return { data: null, error: perm.error };

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { data: null, error: "User with this email already exists" };
    }

    console.log("[Users] Creating user:", data.email);

    const autoPassword = createId();
    const hashedPassword = await bcrypt.hash(autoPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role ?? "ADMIN",
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath("/dashboard/users");
    return { data: { user, generatedPassword: autoPassword }, error: null };
  } catch (error) {
    console.error("Error creating user:", error);
    return { data: null, error: "Failed to create user" };
  }
}

export async function updateUserRole(userId: string, role: UserRole) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(currentUserId, "users", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    if (currentUserId === userId) {
      return { data: null, error: "You cannot change your own role" };
    }

    console.log("[Users] Updating role for user:", userId, "to", role);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath("/dashboard/users");
    return { data: user, error: null };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { data: null, error: "Failed to update user role" };
  }
}

export async function deleteUser(userId: string) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(currentUserId, "users", "delete");
    if (!perm.allowed) return { data: null, error: perm.error };

    if (currentUserId === userId) {
      return { data: null, error: "You cannot delete your own account" };
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/dashboard/users");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { data: null, error: "Failed to delete user" };
  }
}

export async function resetUserPassword(userId: string) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(currentUserId, "users", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    const newPassword = createId();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    revalidatePath("/dashboard/users");
    return { data: { newPassword }, error: null };
  } catch (error) {
    console.error("Error resetting user password:", error);
    return { data: null, error: "Failed to reset user password" };
  }
}

export async function getImpersonationPassword() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "users", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    const adminPass = process.env.ADMIN_PASS;
    if (!adminPass) {
      return { data: null, error: "ADMIN_PASS environment variable not configured" };
    }

    return { data: { password: adminPass }, error: null };
  } catch (error) {
    console.error("Error getting impersonation password:", error);
    return { data: null, error: "Failed to get impersonation password" };
  }
}

export async function updateUserProfile(data: {
  firstName?: string;
  lastName?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName || null }),
        ...(data.lastName !== undefined && { lastName: data.lastName || null }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: user, error: null };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { data: null, error: "Failed to update profile" };
  }
}

export async function updateUserPassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    if (!data.newPassword || data.newPassword.length < 8) {
      return { data: null, error: "New password must be at least 8 characters" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValidPassword) {
      return { data: null, error: "Current password is incorrect" };
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword },
    });

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error updating user password:", error);
    return { data: null, error: "Failed to update password" };
  }
}

// ============================================
// TASK ACTIONS
// ============================================

export async function createTask(data: {
  id?: string;
  name: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  dueDate?: Date;
  projectId: string;
  assigneeId?: string;
  blockedByTaskIds?: string[];
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "tasks", "create");
    if (!perm.allowed) return { data: null, error: perm.error };

    console.log("[Tasks] Creating task:", data.name);

    const task = await prisma.task.create({
      data: {
        ...(data.id && { id: data.id }),
        name: data.name,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: data.dueDate,
        projectId: data.projectId,
        assigneeId: data.assigneeId,
        createdById: userId,
        ...(data.blockedByTaskIds &&
          data.blockedByTaskIds.length > 0 && {
          blockedByTasks: {
            connect: data.blockedByTaskIds.map((id) => ({ id })),
          },
        }),
        ...(data.attachments &&
          data.attachments.length > 0 && {
          attachments: {
            create: data.attachments.map((att) => ({
              name: att.name,
              url: att.url,
              type: att.type,
              size: att.size,
            })),
          },
        }),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, email: true } },
        blockedByTasks: { select: { id: true, name: true, status: true } },
        attachments: { select: { id: true, name: true, url: true, type: true, size: true } },
      },
    });

    revalidatePath("/dashboard/tasks");
    return { data: task, error: null };
  } catch (error) {
    console.error("Error creating task:", error);
    return { data: null, error: "Failed to create task" };
  }
}

export async function updateTask(
  id: string,
  data: {
    name?: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status?: "PENDING_ADMIN_REVIEW" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
    dueDate?: Date | null;
    projectId?: string;
    assigneeId?: string | null;
    blockedByTaskIds?: string[];
    newAttachments?: Array<{
      name: string;
      url: string;
      type: string;
      size: number;
    }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "tasks", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    if (data.newAttachments && data.newAttachments.length > 0) {
      await prisma.attachment.createMany({
        data: data.newAttachments.map((att) => ({
          name: att.name,
          url: att.url,
          type: att.type,
          size: att.size,
          taskId: id,
        })),
      });
    }

    console.log("[Tasks] Updating task:", id);

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
        ...(data.blockedByTaskIds !== undefined && {
          blockedByTasks: {
            set: data.blockedByTaskIds.map((taskId) => ({ id: taskId })),
          },
        }),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, email: true } },
        blockedByTasks: { select: { id: true, name: true, status: true } },
        attachments: { select: { id: true, name: true, url: true, type: true, size: true } },
      },
    });

    revalidatePath("/dashboard/tasks");
    return { data: task, error: null };
  } catch (error) {
    console.error("Error updating task:", error);
    return { data: null, error: "Failed to update task" };
  }
}

export async function deleteAttachment(id: string) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "tasks", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return { data: null, error: "Attachment not found" };
    }

    await prisma.attachment.delete({
      where: { id },
    });

    revalidatePath("/dashboard/tasks");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return { data: null, error: "Failed to delete attachment" };
  }
}

export async function deleteTask(id: string) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "tasks", "delete");
    if (!perm.allowed) return { data: null, error: perm.error };

    await prisma.task.delete({
      where: { id },
    });

    revalidatePath("/dashboard/tasks");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting task:", error);
    return { data: null, error: "Failed to delete task" };
  }
}

// ============================================
// TASK VIEWS (Saved Filters)
// ============================================

export interface TaskViewData {
  id: string;
  name: string;
  viewMode: string;
  sortColumn: string | null;
  sortDirection: string;
  statusFilters: string[];
  priorityFilters: string[];
  projectFilters: string[];
  assigneeFilters: string[];
  createdByFilters: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getTaskViews(): Promise<{
  data: TaskViewData[] | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const taskViews = await prisma.taskView.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    return { data: taskViews, error: null };
  } catch (error) {
    console.error("Error fetching task views:", error);
    return { data: null, error: "Failed to fetch task views" };
  }
}

export async function createTaskView(data: {
  name: string;
  viewMode: string;
  sortColumn: string | null;
  sortDirection: string;
  statusFilters: string[];
  priorityFilters: string[];
  projectFilters: string[];
  assigneeFilters: string[];
  createdByFilters: string[];
}): Promise<{ data: TaskViewData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const existing = await prisma.taskView.findFirst({
      where: { userId: user.id, name: data.name },
    });

    if (existing) {
      return { data: null, error: "A view with this name already exists" };
    }

    const taskView = await prisma.taskView.create({
      data: {
        name: data.name,
        viewMode: data.viewMode,
        sortColumn: data.sortColumn,
        sortDirection: data.sortDirection,
        statusFilters: data.statusFilters,
        priorityFilters: data.priorityFilters,
        projectFilters: data.projectFilters,
        assigneeFilters: data.assigneeFilters,
        createdByFilters: data.createdByFilters,
        userId: user.id,
      },
    });

    revalidatePath("/dashboard/tasks");
    return { data: taskView, error: null };
  } catch (error) {
    console.error("Error creating task view:", error);
    return { data: null, error: "Failed to create task view" };
  }
}

export async function updateTaskView(
  id: string,
  data: { name?: string }
): Promise<{ data: TaskViewData | null; error: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const existing = await prisma.taskView.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { data: null, error: "Task view not found" };
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.taskView.findFirst({
        where: { userId: user.id, name: data.name, NOT: { id } },
      });
      if (duplicate) {
        return { data: null, error: "A view with this name already exists" };
      }
    }

    const taskView = await prisma.taskView.update({
      where: { id },
      data: { ...(data.name && { name: data.name }) },
    });

    revalidatePath("/dashboard/tasks");
    return { data: taskView, error: null };
  } catch (error) {
    console.error("Error updating task view:", error);
    return { data: null, error: "Failed to update task view" };
  }
}

export async function deleteTaskView(id: string): Promise<{
  data: boolean | null;
  error: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { data: null, error: "Not authenticated" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    const existing = await prisma.taskView.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { data: null, error: "Task view not found" };
    }

    await prisma.taskView.delete({ where: { id } });

    revalidatePath("/dashboard/tasks");
    return { data: true, error: null };
  } catch (error) {
    console.error("Error deleting task view:", error);
    return { data: null, error: "Failed to delete task view" };
  }
}

// ============================================
// COMMAND PALETTE SEARCH
// ============================================

export interface CommandPaletteResult {
  id: string;
  name: string;
  type: "task" | "project" | "user";
  subtitle?: string;
  href: string;
}

export async function searchCommandPalette(query: string): Promise<{
  data: CommandPaletteResult[] | null;
  error: string | null;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "tasks", "read");
    if (!perm.allowed) return { data: null, error: perm.error };

    if (!query || query.trim().length < 2) {
      return { data: [], error: null };
    }

    const searchTerm = query.trim();
    const results: CommandPaletteResult[] = [];

    const tasks = await prisma.task.findMany({
      where: { name: { contains: searchTerm, mode: "insensitive" } },
      select: { id: true, name: true, project: { select: { name: true } } },
      take: 3,
    });
    results.push(
      ...tasks.map((t) => ({
        id: t.id,
        name: t.name,
        type: "task" as const,
        subtitle: t.project?.name,
        href: `/dashboard/tasks?highlight=${t.id}`,
      }))
    );

    const projects = await prisma.project.findMany({
      where: { name: { contains: searchTerm, mode: "insensitive" } },
      select: { id: true, name: true },
      take: 2,
    });
    results.push(
      ...projects.map((p) => ({
        id: p.id,
        name: p.name,
        type: "project" as const,
        href: `/dashboard/projects/${p.id}`,
      }))
    );

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: searchTerm, mode: "insensitive" } },
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
      take: 2,
    });
    results.push(
      ...users.map((u) => ({
        id: u.id,
        name: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email,
        type: "user" as const,
        subtitle: u.role,
        href: "/dashboard/users",
      }))
    );

    return { data: results.slice(0, 10), error: null };
  } catch (error) {
    console.error("Error searching command palette:", error);
    return { data: null, error: "Failed to search" };
  }
}

// ============================================
// RECURRING TASK ACTIONS
// ============================================

export interface RecurringTaskData {
  id: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  isActive: boolean;
  lastCreatedAt: Date | null;
  projectId: string;
  project: { id: string; name: string };
  assigneeId: string | null;
  assignee: { id: string; email: string; firstName: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createRecurringTask(data: {
  name: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: number;
  dayOfMonth?: number;
  projectId: string;
  assigneeId?: string;
}): Promise<{ data: RecurringTaskData | null; error: string | null }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "recurringTasks", "create");
    if (!perm.allowed) return { data: null, error: perm.error };

    console.log("[RecurringTasks] Creating recurring task:", data.name);

    const recurringTask = await prisma.recurringTask.create({
      data: {
        name: data.name,
        description: data.description,
        priority: data.priority,
        frequency: data.frequency,
        dayOfWeek: data.frequency === "WEEKLY" ? data.dayOfWeek : null,
        dayOfMonth: data.frequency === "MONTHLY" ? data.dayOfMonth : null,
        projectId: data.projectId,
        assigneeId: data.assigneeId,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, email: true, firstName: true } },
      },
    });

    revalidatePath("/dashboard/recurring-tasks");
    return { data: recurringTask as RecurringTaskData, error: null };
  } catch (error) {
    console.error("Error creating recurring task:", error);
    return { data: null, error: "Failed to create recurring task" };
  }
}

export async function updateRecurringTask(
  id: string,
  data: {
    name?: string;
    description?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    isActive?: boolean;
    projectId?: string;
    assigneeId?: string | null;
  }
): Promise<{ data: RecurringTaskData | null; error: string | null }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "recurringTasks", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    console.log("[RecurringTasks] Updating recurring task:", id);

    const updateData: Prisma.RecurringTaskUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.projectId !== undefined) {
      updateData.project = { connect: { id: data.projectId } };
    }
    if (data.assigneeId !== undefined) {
      if (data.assigneeId === null) {
        updateData.assignee = { disconnect: true };
      } else {
        updateData.assignee = { connect: { id: data.assigneeId } };
      }
    }
    if (data.frequency !== undefined) {
      updateData.frequency = data.frequency;
      if (data.frequency === "DAILY") {
        updateData.dayOfWeek = null;
        updateData.dayOfMonth = null;
      } else if (data.frequency === "WEEKLY") {
        updateData.dayOfWeek = data.dayOfWeek ?? null;
        updateData.dayOfMonth = null;
      } else if (data.frequency === "MONTHLY") {
        updateData.dayOfWeek = null;
        updateData.dayOfMonth = data.dayOfMonth ?? null;
      }
    } else {
      if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
      if (data.dayOfMonth !== undefined) updateData.dayOfMonth = data.dayOfMonth;
    }

    const recurringTask = await prisma.recurringTask.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, email: true, firstName: true } },
      },
    });

    revalidatePath("/dashboard/recurring-tasks");
    return { data: recurringTask as RecurringTaskData, error: null };
  } catch (error) {
    console.error("Error updating recurring task:", error);
    return { data: null, error: "Failed to update recurring task" };
  }
}

export async function deleteRecurringTask(id: string): Promise<{
  data: { success: boolean } | null;
  error: string | null;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "recurringTasks", "delete");
    if (!perm.allowed) return { data: null, error: perm.error };

    await prisma.recurringTask.delete({ where: { id } });

    revalidatePath("/dashboard/recurring-tasks");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Error deleting recurring task:", error);
    return { data: null, error: "Failed to delete recurring task" };
  }
}

export async function toggleRecurringTaskActive(id: string): Promise<{
  data: RecurringTaskData | null;
  error: string | null;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: "Not authenticated" };

    const perm = await requirePermission(userId, "recurringTasks", "update");
    if (!perm.allowed) return { data: null, error: perm.error };

    const current = await prisma.recurringTask.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!current) {
      return { data: null, error: "Recurring task not found" };
    }

    const recurringTask = await prisma.recurringTask.update({
      where: { id },
      data: { isActive: !current.isActive },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, email: true, firstName: true } },
      },
    });

    revalidatePath("/dashboard/recurring-tasks");
    return { data: recurringTask as RecurringTaskData, error: null };
  } catch (error) {
    console.error("Error toggling recurring task:", error);
    return { data: null, error: "Failed to toggle recurring task" };
  }
}
