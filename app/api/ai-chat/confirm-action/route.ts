import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUserPermissions, hasFeatureAccess, hasResourcePermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const permissions = await getUserPermissions(user.id);
    if (!hasFeatureAccess(permissions, "aiChat")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { type, ids } = await request.json();

    if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    console.log(`[AI Chat] Confirming delete action: ${type}, ${ids.length} items`);

    switch (type) {
      case "deleteTasks": {
        if (!hasResourcePermission(permissions, "tasks", "delete")) {
          return NextResponse.json({ error: "You don't have permission to delete tasks" }, { status: 403 });
        }
        const result = await prisma.task.deleteMany({ where: { id: { in: ids } } });
        revalidatePath("/dashboard/tasks");
        revalidatePath("/dashboard/projects");
        return NextResponse.json({ success: true, deletedCount: result.count });
      }

      case "deleteProjects": {
        if (!hasResourcePermission(permissions, "projects", "delete")) {
          return NextResponse.json({ error: "You don't have permission to delete projects" }, { status: 403 });
        }
        const result = await prisma.project.deleteMany({ where: { id: { in: ids } } });
        revalidatePath("/dashboard/tasks");
        revalidatePath("/dashboard/projects");
        return NextResponse.json({ success: true, deletedCount: result.count });
      }

      case "deleteRecurringTasks": {
        if (!hasResourcePermission(permissions, "recurringTasks", "delete")) {
          return NextResponse.json({ error: "You don't have permission to delete recurring tasks" }, { status: 403 });
        }
        const result = await prisma.recurringTask.deleteMany({ where: { id: { in: ids } } });
        revalidatePath("/dashboard/recurring-tasks");
        return NextResponse.json({ success: true, deletedCount: result.count });
      }

      default:
        return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
    }
  } catch (error) {
    console.error("[AI Chat] Confirm action error:", error);
    return NextResponse.json({ error: "Failed to execute action" }, { status: 500 });
  }
}
