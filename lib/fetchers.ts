"use server";

import prisma from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import type { Permissions } from "@/config/permissions";

// ============================================
// PROJECTS
// ============================================

export async function getProjects() {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: projects, error: null };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { data: null, error: "Failed to fetch projects" };
  }
}

export async function getProject(id: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      return { data: null, error: "Project not found" };
    }

    return { data: project, error: null };
  } catch (error) {
    console.error("Error fetching project:", error);
    return { data: null, error: "Failed to fetch project" };
  }
}

// ============================================
// USERS
// ============================================

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { data: null, error: "Failed to fetch users" };
  }
}

export async function getAssignableUsers() {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MEMBER"] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { email: "asc" },
    });

    return { data: users, error: null };
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return { data: null, error: "Failed to fetch assignable users" };
  }
}

// ============================================
// TASKS
// ============================================

export async function getTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        blockedByTasks: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        attachments: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            size: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: tasks, error: null };
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return { data: null, error: "Failed to fetch tasks" };
  }
}

export async function getTask(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        blockedByTasks: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        attachments: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (!task) {
      return { data: null, error: "Task not found" };
    }

    return { data: task, error: null };
  } catch (error) {
    console.error("Error fetching task:", error);
    return { data: null, error: "Failed to fetch task" };
  }
}

export async function getTasksByProject(projectId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        blockedByTasks: {
          select: { id: true, name: true, status: true },
        },
        attachments: {
          select: { id: true, name: true, url: true, type: true, size: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: tasks, error: null };
  } catch (error) {
    console.error("Error fetching tasks by project:", error);
    return { data: null, error: "Failed to fetch tasks" };
  }
}

// ============================================
// RECURRING TASKS
// ============================================

export async function getRecurringTasks() {
  try {
    const recurringTasks = await prisma.recurringTask.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: recurringTasks, error: null };
  } catch (error) {
    console.error("Error fetching recurring tasks:", error);
    return { data: null, error: "Failed to fetch recurring tasks" };
  }
}

export async function getRecurringTask(id: string) {
  try {
    const recurringTask = await prisma.recurringTask.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    if (!recurringTask) {
      return { data: null, error: "Recurring task not found" };
    }

    return { data: recurringTask, error: null };
  } catch (error) {
    console.error("Error fetching recurring task:", error);
    return { data: null, error: "Failed to fetch recurring task" };
  }
}

// ============================================
// ROLES & PERMISSIONS
// ============================================

export async function getRoles() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } },
    });

    return { data: roles, error: null };
  } catch (error) {
    console.error("Error fetching roles:", error);
    return { data: null, error: "Failed to fetch roles" };
  }
}

export async function getRole(id: string) {
  try {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) return { data: null, error: "Role not found" };
    return { data: role, error: null };
  } catch (error) {
    console.error("Error fetching role:", error);
    return { data: null, error: "Failed to fetch role" };
  }
}

export async function fetchUserPermissions(userId: string): Promise<{
  data: Permissions | null;
  error: string | null;
}> {
  try {
    const permissions = await getUserPermissions(userId);
    return { data: permissions, error: null };
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return { data: null, error: "Failed to fetch permissions" };
  }
}
