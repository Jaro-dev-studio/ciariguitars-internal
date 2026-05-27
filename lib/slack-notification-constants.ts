import { SlackNotificationEventType } from "@prisma/client";

export type { SlackNotificationEventType };

export interface SlackNotificationConfigData {
  id: string;
  eventType: SlackNotificationEventType;
  sendToPublic: boolean;
  sendToInternal: boolean;
  projectId: string;
}

export interface ProjectNotificationSettings {
  projectId: string;
  projectName: string;
  configs: SlackNotificationConfigData[];
}

export const EVENT_TYPE_LABELS: Record<SlackNotificationEventType, string> = {
  TASK_COMPLETED: "Task Completed",
  TASK_UNBLOCKED: "Task Unblocked",
};

export const EVENT_TYPE_DESCRIPTIONS: Record<SlackNotificationEventType, string> = {
  TASK_COMPLETED: "When a task is marked as done",
  TASK_UNBLOCKED: "When all blockers for a task are resolved",
};

export const ALL_EVENT_TYPES: SlackNotificationEventType[] = [
  "TASK_COMPLETED",
  "TASK_UNBLOCKED",
];
