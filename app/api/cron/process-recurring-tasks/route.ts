import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Vercel cron: max 300 seconds execution time
export const maxDuration = 300;

/**
 * Check if a recurring task should create a task today
 */
function shouldCreateTaskToday(
  frequency: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  lastCreatedAt: Date | null,
  now: Date
): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // If already created today, skip
  if (lastCreatedAt) {
    const lastCreatedDate = new Date(
      lastCreatedAt.getFullYear(),
      lastCreatedAt.getMonth(),
      lastCreatedAt.getDate()
    );
    if (lastCreatedDate.getTime() === today.getTime()) {
      return false;
    }
  }

  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentDayOfMonth = now.getDate(); // 1-31

  switch (frequency) {
    case "DAILY":
      return true;

    case "WEEKLY":
      // dayOfWeek: 0 = Sunday, 6 = Saturday
      return dayOfWeek !== null && currentDayOfWeek === dayOfWeek;

    case "MONTHLY":
      // dayOfMonth: 1-31
      return dayOfMonth !== null && currentDayOfMonth === dayOfMonth;

    default:
      return false;
  }
}

export async function GET() {
  try {
    console.log("[CronRecurringTasks] ========== Starting Recurring Tasks Processing ==========");
    const now = new Date();
    console.log(`[CronRecurringTasks] Current time: ${now.toISOString()}`);
    console.log(`[CronRecurringTasks] Day of week: ${now.getDay()} (0=Sun, 6=Sat)`);
    console.log(`[CronRecurringTasks] Day of month: ${now.getDate()}`);

    // Step 1: Get all active recurring tasks
    console.log("[CronRecurringTasks] Step 1: Fetching active recurring tasks...");
    const recurringTasks = await prisma.recurringTask.findMany({
      where: {
        isActive: true,
      },
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
          },
        },
      },
    });
    console.log(`[CronRecurringTasks] Step 1: Found ${recurringTasks.length} active recurring tasks`);

    const results = {
      total: recurringTasks.length,
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Step 2: Process each recurring task
    console.log("[CronRecurringTasks] Step 2: Processing recurring tasks...");

    for (const recurringTask of recurringTasks) {
      try {
        console.log(`[CronRecurringTasks] Processing: ${recurringTask.name} (${recurringTask.id})`);
        console.log(`[CronRecurringTasks]   Frequency: ${recurringTask.frequency}`);
        console.log(`[CronRecurringTasks]   Day of Week: ${recurringTask.dayOfWeek}`);
        console.log(`[CronRecurringTasks]   Day of Month: ${recurringTask.dayOfMonth}`);
        console.log(`[CronRecurringTasks]   Last Created: ${recurringTask.lastCreatedAt?.toISOString() || "Never"}`);

        // Check if we should create a task today
        const shouldCreate = shouldCreateTaskToday(
          recurringTask.frequency,
          recurringTask.dayOfWeek,
          recurringTask.dayOfMonth,
          recurringTask.lastCreatedAt,
          now
        );

        if (!shouldCreate) {
          console.log("[CronRecurringTasks]   -> SKIPPED: Not scheduled for today");
          results.skipped++;
          continue;
        }

        console.log("[CronRecurringTasks]   -> CREATING TASK");

        // Create the task
        const task = await prisma.task.create({
          data: {
            name: recurringTask.name,
            description: recurringTask.description,
            priority: recurringTask.priority,
            status: "TODO",
            projectId: recurringTask.projectId,
            assigneeId: recurringTask.assigneeId,
          },
        });

        console.log(`[CronRecurringTasks]   Created task: ${task.id}`);

        // Update the recurring task's lastCreatedAt
        await prisma.recurringTask.update({
          where: { id: recurringTask.id },
          data: { lastCreatedAt: now },
        });

        results.processed++;
      } catch (error) {
        const errorMsg = `${recurringTask.name} (${recurringTask.id}): ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[CronRecurringTasks] ERROR: ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    console.log("[CronRecurringTasks] ========== Processing Complete ==========");
    console.log(`[CronRecurringTasks] Summary: ${results.processed} created, ${results.skipped} skipped, ${results.errors.length} errors`);

    return NextResponse.json({
      data: results,
      error: null,
    });
  } catch (error) {
    console.error("[CronRecurringTasks] FATAL ERROR:", error);
    return NextResponse.json(
      {
        data: null,
        error: `Cron job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
