import prisma from "@/lib/prisma";
import { SlackNotificationEventType } from "@prisma/client";

export type {
  SlackNotificationConfigData,
  ProjectNotificationSettings,
} from "@/lib/slack-notification-constants";

interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
}

async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      console.error("[Slack] Bot token not configured");
      return false;
    }

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error("[Slack] Failed to send message:", result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Slack] Error sending message:", error);
    return false;
  }
}

export async function sendNotification(
  projectId: string,
  eventType: SlackNotificationEventType,
  text: string,
  blocks?: any[]
) {
  try {
    const config = await prisma.slackNotificationConfig.findUnique({
      where: {
        projectId_eventType: {
          projectId,
          eventType,
        },
      },
      include: {
        project: true,
      },
    });

    if (!config) return;

    const channels: string[] = [];
    if (config.sendToPublic) {
      channels.push("general");
    }
    if (config.sendToInternal) {
      channels.push("internal");
    }

    for (const channel of channels) {
      await sendSlackMessage({
        channel,
        text,
        blocks,
      });
    }
  } catch (error) {
    console.error("[Slack] Error sending notification:", error);
  }
}

export async function notifyTaskCompleted(
  projectId: string,
  taskId: string,
  name: string,
  assigneeEmail?: string | null
) {
  const text = `Task completed: *${name}*${assigneeEmail ? ` by ${assigneeEmail}` : ""}`;
  await sendNotification(projectId, "TASK_COMPLETED", text);
}

export async function notifyTaskUnblocked(
  projectId: string,
  taskId: string,
  name: string
) {
  const text = `Task unblocked: *${name}*`;
  await sendNotification(projectId, "TASK_UNBLOCKED", text);
}

export async function checkAndNotifyUnblockedTasks(
  completedItemId: string
) {
  try {
    const blockedTasks = await prisma.task.findMany({
      where: {
        status: "BLOCKED",
        blockedByTasks: {
          some: { id: completedItemId },
        },
      },
      include: {
        blockedByTasks: true,
      },
    });

    for (const task of blockedTasks) {
      const allBlockersResolved = task.blockedByTasks.every(
        (blocker) => blocker.status === "DONE"
      );

      if (allBlockersResolved) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: "TODO" },
        });
        await notifyTaskUnblocked(task.projectId, task.id, task.name);
      }
    }
  } catch (error) {
    console.error("[Slack] Error checking unblocked tasks:", error);
  }
}
