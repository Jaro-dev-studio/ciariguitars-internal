import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { TaskPriority, TaskStatus, ProjectStatus, RecurrenceFrequency } from "@prisma/client";
import { getUserPermissions, hasFeatureAccess, hasResourcePermission } from "@/lib/permissions";
import type { Permissions } from "@/config/permissions";
import OpenAI from "openai";
import type { ChatCompletionTool, ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const maxDuration = 60;

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are a helpful AI assistant for an internal business tools dashboard. You have full access to the system's data through tools.

You can:
- Query tasks, projects, users, and recurring tasks
- Create new tasks, projects, and recurring tasks
- Update existing tasks, projects, and recurring tasks
- Request deletion of tasks, projects, and recurring tasks (requires user confirmation)

Guidelines:
- Always use tools to look up real data instead of guessing
- When creating or updating items, confirm the details with the user if ambiguous
- For deletions, always use the delete tools which will prompt the user for confirmation
- Be concise and professional
- Format data clearly using markdown tables or lists when showing multiple items
- When showing tasks, include status and priority
- When a user asks to do something, do it immediately using tools rather than just explaining how`;

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "listTasks",
      description: "Search and list tasks. Returns tasks matching the given filters.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term to match against task name" },
          status: {
            type: "array",
            items: { type: "string", enum: ["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"] },
            description: "Filter by status",
          },
          priority: {
            type: "array",
            items: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
            description: "Filter by priority",
          },
          projectId: { type: "string", description: "Filter by project ID" },
          assigneeId: { type: "string", description: "Filter by assignee user ID" },
          limit: { type: "number", description: "Max results to return (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listProjects",
      description: "List all projects with their task and member counts.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term to match against project name" },
          status: {
            type: "array",
            items: { type: "string", enum: ["ACTIVE", "ARCHIVED", "COMPLETED"] },
            description: "Filter by status",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listUsers",
      description: "List all users in the system.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by email, first name, or last name" },
          role: {
            type: "array",
            items: { type: "string", enum: ["ADMIN", "MEMBER", "VIEWER"] },
            description: "Filter by role",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listRecurringTasks",
      description: "List recurring tasks with their schedules.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Filter by project ID" },
          isActive: { type: "boolean", description: "Filter by active status" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getStats",
      description: "Get summary statistics about tasks, projects, and users.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a new task. Requires at least a name and projectId.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Task name" },
          description: { type: "string", description: "Task description" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "Priority level (default MEDIUM)" },
          status: { type: "string", enum: ["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"], description: "Task status (default TODO)" },
          dueDate: { type: "string", description: "Due date in ISO format" },
          projectId: { type: "string", description: "Project ID to assign to" },
          assigneeId: { type: "string", description: "User ID to assign to" },
        },
        required: ["name", "projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createProject",
      description: "Create a new project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project name" },
          description: { type: "string", description: "Project description" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createRecurringTask",
      description: "Create a new recurring task that generates tasks on a schedule.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Task name" },
          description: { type: "string", description: "Task description" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          frequency: { type: "string", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
          dayOfWeek: { type: "number", description: "Day of week (0=Sunday, 6=Saturday) for WEEKLY tasks" },
          dayOfMonth: { type: "number", description: "Day of month (1-31) for MONTHLY tasks" },
          projectId: { type: "string", description: "Project ID" },
          assigneeId: { type: "string", description: "User ID to assign to" },
        },
        required: ["name", "frequency", "projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTask",
      description: "Update an existing task by ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task ID to update" },
          name: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          status: { type: "string", enum: ["PENDING_ADMIN_REVIEW", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"] },
          dueDate: { type: "string", description: "Due date in ISO format, or null to clear" },
          projectId: { type: "string" },
          assigneeId: { type: "string", description: "User ID, or null to unassign" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateProject",
      description: "Update an existing project by ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Project ID to update" },
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "ARCHIVED", "COMPLETED"] },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateRecurringTask",
      description: "Update an existing recurring task by ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Recurring task ID to update" },
          name: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          frequency: { type: "string", enum: ["DAILY", "WEEKLY", "MONTHLY"] },
          dayOfWeek: { type: "number" },
          dayOfMonth: { type: "number" },
          isActive: { type: "boolean" },
          projectId: { type: "string" },
          assigneeId: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteTasks",
      description: "Delete one or more tasks by their IDs. This will request user confirmation before executing.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "Array of task IDs to delete" },
        },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteProjects",
      description: "Delete one or more projects by their IDs. This will also delete all tasks in those projects. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "Array of project IDs to delete" },
        },
        required: ["ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteRecurringTasks",
      description: "Delete one or more recurring tasks by their IDs. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "Array of recurring task IDs to delete" },
        },
        required: ["ids"],
      },
    },
  },
];

interface PendingAction {
  type: "deleteTasks" | "deleteProjects" | "deleteRecurringTasks";
  ids: string[];
  itemNames: string[];
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userRole: string,
  permissions?: Permissions
): Promise<{ result: unknown; pendingAction?: PendingAction }> {
  console.log(`[AI Chat] Executing tool: ${name}`);

  switch (name) {
    case "listTasks": {
      const where: Record<string, unknown> = {};
      if (args.search) where.name = { contains: args.search as string, mode: "insensitive" };
      if (args.status) where.status = { in: args.status as string[] };
      if (args.priority) where.priority = { in: args.priority as string[] };
      if (args.projectId) where.projectId = args.projectId;
      if (args.assigneeId) where.assigneeId = args.assigneeId;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: (args.limit as number) || 20,
      });

      return {
        result: tasks.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          project: t.project?.name,
          projectId: t.projectId,
          assignee: t.assignee ? (t.assignee.firstName || t.assignee.email) : null,
          assigneeId: t.assigneeId,
        })),
      };
    }

    case "listProjects": {
      const where: Record<string, unknown> = {};
      if (args.search) where.name = { contains: args.search as string, mode: "insensitive" };
      if (args.status) where.status = { in: args.status as string[] };

      const projects = await prisma.project.findMany({
        where,
        include: { _count: { select: { tasks: true, members: true } } },
        orderBy: { createdAt: "desc" },
      });

      return {
        result: projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          taskCount: p._count.tasks,
          memberCount: p._count.members,
        })),
      };
    }

    case "listUsers": {
      const where: Record<string, unknown> = {};
      if (args.role) where.role = { in: args.role as string[] };
      if (args.search) {
        where.OR = [
          { email: { contains: args.search as string, mode: "insensitive" } },
          { firstName: { contains: args.search as string, mode: "insensitive" } },
          { lastName: { contains: args.search as string, mode: "insensitive" } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
        orderBy: { email: "asc" },
      });

      return { result: users };
    }

    case "listRecurringTasks": {
      const where: Record<string, unknown> = {};
      if (args.projectId) where.projectId = args.projectId;
      if (args.isActive !== undefined) where.isActive = args.isActive;

      const tasks = await prisma.recurringTask.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, email: true, firstName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        result: tasks.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          priority: t.priority,
          frequency: t.frequency,
          dayOfWeek: t.dayOfWeek,
          dayOfMonth: t.dayOfMonth,
          isActive: t.isActive,
          project: t.project?.name,
          projectId: t.projectId,
          assignee: t.assignee ? (t.assignee.firstName || t.assignee.email) : null,
          assigneeId: t.assigneeId,
        })),
      };
    }

    case "getStats": {
      const [taskCount, projectCount, userCount, tasksByStatus, tasksByPriority] = await Promise.all([
        prisma.task.count(),
        prisma.project.count(),
        prisma.user.count(),
        prisma.task.groupBy({ by: ["status"], _count: true }),
        prisma.task.groupBy({ by: ["priority"], _count: true }),
      ]);

      return {
        result: {
          totalTasks: taskCount,
          totalProjects: projectCount,
          totalUsers: userCount,
          tasksByStatus: Object.fromEntries(tasksByStatus.map((s) => [s.status, s._count])),
          tasksByPriority: Object.fromEntries(tasksByPriority.map((p) => [p.priority, p._count])),
        },
      };
    }

    case "createTask": {
      if (permissions && !hasResourcePermission(permissions, "tasks", "create")) {
        return { result: { error: "You don't have permission to create tasks" } };
      }
      const task = await prisma.task.create({
        data: {
          name: args.name as string,
          description: (args.description as string) || undefined,
          priority: ((args.priority as string) || "MEDIUM") as TaskPriority,
          status: ((args.status as string) || "TODO") as TaskStatus,
          dueDate: args.dueDate ? new Date(args.dueDate as string) : undefined,
          projectId: args.projectId as string,
          assigneeId: (args.assigneeId as string) || undefined,
        },
        include: { project: { select: { name: true } } },
      });
      return { result: { success: true, task: { id: task.id, name: task.name, project: task.project?.name } } };
    }

    case "createProject": {
      if (permissions && !hasResourcePermission(permissions, "projects", "create")) {
        return { result: { error: "You don't have permission to create projects" } };
      }
      const project = await prisma.project.create({
        data: {
          name: args.name as string,
          description: (args.description as string) || undefined,
        },
      });
      return { result: { success: true, project: { id: project.id, name: project.name } } };
    }

    case "createRecurringTask": {
      if (permissions && !hasResourcePermission(permissions, "recurringTasks", "create")) {
        return { result: { error: "You don't have permission to create recurring tasks" } };
      }
      const rt = await prisma.recurringTask.create({
        data: {
          name: args.name as string,
          description: (args.description as string) || undefined,
          priority: ((args.priority as string) || "MEDIUM") as TaskPriority,
          frequency: args.frequency as RecurrenceFrequency,
          dayOfWeek: args.frequency === "WEEKLY" ? (args.dayOfWeek as number) : undefined,
          dayOfMonth: args.frequency === "MONTHLY" ? (args.dayOfMonth as number) : undefined,
          projectId: args.projectId as string,
          assigneeId: (args.assigneeId as string) || undefined,
        },
        include: { project: { select: { name: true } } },
      });
      return { result: { success: true, recurringTask: { id: rt.id, name: rt.name, project: rt.project?.name } } };
    }

    case "updateTask": {
      if (permissions && !hasResourcePermission(permissions, "tasks", "update")) {
        return { result: { error: "You don't have permission to update tasks" } };
      }
      const taskUpdateData: Record<string, unknown> = {};
      if (args.name !== undefined) taskUpdateData.name = args.name;
      if (args.description !== undefined) taskUpdateData.description = args.description;
      if (args.priority !== undefined) taskUpdateData.priority = args.priority as TaskPriority;
      if (args.status !== undefined) taskUpdateData.status = args.status as TaskStatus;
      if (args.dueDate !== undefined) taskUpdateData.dueDate = args.dueDate ? new Date(args.dueDate as string) : null;
      if (args.projectId !== undefined) taskUpdateData.projectId = args.projectId;
      if (args.assigneeId !== undefined) taskUpdateData.assigneeId = args.assigneeId || null;

      const updated = await prisma.task.update({
        where: { id: args.id as string },
        data: taskUpdateData,
        select: { id: true, name: true, status: true, priority: true },
      });
      return { result: { success: true, task: updated } };
    }

    case "updateProject": {
      if (permissions && !hasResourcePermission(permissions, "projects", "update")) {
        return { result: { error: "You don't have permission to update projects" } };
      }
      const projUpdateData: Record<string, unknown> = {};
      if (args.name !== undefined) projUpdateData.name = args.name;
      if (args.description !== undefined) projUpdateData.description = args.description;
      if (args.status !== undefined) projUpdateData.status = args.status as ProjectStatus;

      const updatedProj = await prisma.project.update({
        where: { id: args.id as string },
        data: projUpdateData,
        select: { id: true, name: true, status: true },
      });
      return { result: { success: true, project: updatedProj } };
    }

    case "updateRecurringTask": {
      if (permissions && !hasResourcePermission(permissions, "recurringTasks", "update")) {
        return { result: { error: "You don't have permission to update recurring tasks" } };
      }
      const rtUpdateData: Record<string, unknown> = {};
      if (args.name !== undefined) rtUpdateData.name = args.name;
      if (args.description !== undefined) rtUpdateData.description = args.description;
      if (args.priority !== undefined) rtUpdateData.priority = args.priority as TaskPriority;
      if (args.frequency !== undefined) rtUpdateData.frequency = args.frequency as RecurrenceFrequency;
      if (args.dayOfWeek !== undefined) rtUpdateData.dayOfWeek = args.dayOfWeek;
      if (args.dayOfMonth !== undefined) rtUpdateData.dayOfMonth = args.dayOfMonth;
      if (args.isActive !== undefined) rtUpdateData.isActive = args.isActive;
      if (args.projectId !== undefined) rtUpdateData.projectId = args.projectId;
      if (args.assigneeId !== undefined) rtUpdateData.assigneeId = args.assigneeId || null;

      const updatedRt = await prisma.recurringTask.update({
        where: { id: args.id as string },
        data: rtUpdateData,
        select: { id: true, name: true, isActive: true },
      });
      return { result: { success: true, recurringTask: updatedRt } };
    }

    case "deleteTasks": {
      if (permissions && !hasResourcePermission(permissions, "tasks", "delete")) {
        return { result: { error: "You don't have permission to delete tasks" } };
      }
      const ids = args.ids as string[];
      const items = await prisma.task.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      if (items.length === 0) return { result: { error: "No tasks found with those IDs" } };

      return {
        result: { needsConfirmation: true, count: items.length, items: items.map((i) => i.name) },
        pendingAction: { type: "deleteTasks", ids: items.map((i) => i.id), itemNames: items.map((i) => i.name) },
      };
    }

    case "deleteProjects": {
      if (permissions && !hasResourcePermission(permissions, "projects", "delete")) {
        return { result: { error: "You don't have permission to delete projects" } };
      }
      const ids = args.ids as string[];
      const items = await prisma.project.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, _count: { select: { tasks: true } } },
      });
      if (items.length === 0) return { result: { error: "No projects found with those IDs" } };

      return {
        result: {
          needsConfirmation: true,
          count: items.length,
          items: items.map((i) => `${i.name} (${i._count.tasks} tasks)`),
        },
        pendingAction: { type: "deleteProjects", ids: items.map((i) => i.id), itemNames: items.map((i) => i.name) },
      };
    }

    case "deleteRecurringTasks": {
      if (permissions && !hasResourcePermission(permissions, "recurringTasks", "delete")) {
        return { result: { error: "You don't have permission to delete recurring tasks" } };
      }
      const ids = args.ids as string[];
      const items = await prisma.recurringTask.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      if (items.length === 0) return { result: { error: "No recurring tasks found with those IDs" } };

      return {
        result: { needsConfirmation: true, count: items.length, items: items.map((i) => i.name) },
        pendingAction: { type: "deleteRecurringTasks", ids: items.map((i) => i.id), itemNames: items.map((i) => i.name) },
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_end"; name: string }
  | { type: "content"; content: string }
  | { type: "pending_action"; action: PendingAction }
  | { type: "done"; toolCalls: Array<{ name: string; args: unknown; result: unknown }>; title?: string }
  | { type: "error"; message: string };

function encodeStreamEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(
        encodeStreamEvent({ type: "error", message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return new Response(
        encodeStreamEvent({ type: "error", message: "Access denied" }),
        { status: 403, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const userPermissions = await getUserPermissions(user.id);
    if (!hasFeatureAccess(userPermissions, "aiChat")) {
      return new Response(
        encodeStreamEvent({ type: "error", message: "Access denied" }),
        { status: 403, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const { id: chatId } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        encodeStreamEvent({ type: "error", message: "Message is required" }),
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const chat = await prisma.aIChat.findFirst({
      where: { id: chatId, userId: user.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!chat) {
      return new Response(
        encodeStreamEvent({ type: "error", message: "Chat not found" }),
        { status: 404, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        };

        try {
          await prisma.aIChatMessage.create({
            data: { chatId, role: "user", content: message },
          });

          send({ type: "status", message: "Processing your request..." });

          const messages: ChatCompletionMessageParam[] = [
            { role: "system", content: SYSTEM_PROMPT },
            ...chat.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            { role: "user", content: message },
          ];

          const allToolCalls: Array<{ name: string; args: unknown; result: unknown }> = [];
          const pendingActions: PendingAction[] = [];
          let iterations = 0;
          const MAX_ITERATIONS = 8;

          // Tool-calling loop: non-streaming calls until the model stops calling tools
          while (iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages,
              tools,
              tool_choice: "auto",
            });

            const choice = response.choices[0];

            if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
              // No more tools -- stream the final response
              const finalContent = choice.message.content || "";

              // Send pending actions before content
              for (const action of pendingActions) {
                send({ type: "pending_action", action });
              }

              // Stream the content character by character for a smooth UX
              const words = finalContent.split(/(\s+)/);
              let buffer = "";
              for (const word of words) {
                buffer += word;
                if (buffer.length >= 4) {
                  send({ type: "content", content: buffer });
                  buffer = "";
                  await new Promise((r) => setTimeout(r, 10));
                }
              }
              if (buffer) {
                send({ type: "content", content: buffer });
              }

              // Save assistant message
              await prisma.aIChatMessage.create({
                data: {
                  chatId,
                  role: "assistant",
                  content: finalContent,
                  toolCalls: allToolCalls.length > 0 ? JSON.parse(JSON.stringify(allToolCalls)) : undefined,
                },
              });

              // Generate title for first message
              let newTitle: string | undefined;
              if (chat.messages.length === 0) {
                const titleResponse = await openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    {
                      role: "system",
                      content:
                        "Generate a short title (max 5 words) for a chat that starts with this message. Return only the title, no quotes or punctuation.",
                    },
                    { role: "user", content: message },
                  ],
                  max_completion_tokens: 20,
                });
                newTitle = titleResponse.choices[0].message.content?.trim() || "New Chat";
                await prisma.aIChat.update({
                  where: { id: chatId },
                  data: { title: newTitle },
                });
              } else {
                await prisma.aIChat.update({
                  where: { id: chatId },
                  data: { updatedAt: new Date() },
                });
              }

              send({ type: "done", toolCalls: allToolCalls, title: newTitle });
              break;
            }

            // Execute tool calls
            messages.push(choice.message);

            for (const toolCall of choice.message.tool_calls) {
              const fnName = toolCall.function.name;
              let fnArgs: Record<string, unknown> = {};
              try {
                fnArgs = JSON.parse(toolCall.function.arguments);
              } catch {
                fnArgs = {};
              }

              send({ type: "tool_start", name: fnName });

              const { result, pendingAction } = await executeTool(fnName, fnArgs, user.role, userPermissions);

              if (pendingAction) {
                pendingActions.push(pendingAction);
              }

              allToolCalls.push({ name: fnName, args: fnArgs, result });

              send({ type: "tool_end", name: fnName });

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            }
          }

          controller.close();
        } catch (error) {
          console.error("[AI Chat] Stream error:", error);
          send({ type: "error", message: "Failed to process message" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI Chat] POST error:", error);
    return new Response(
      encodeStreamEvent({ type: "error", message: "Failed to process message" }),
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }
}
