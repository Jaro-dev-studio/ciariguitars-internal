"use client";

import { useState } from "react";
import { Bell, FolderKanban, CheckCircle2, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateNotificationConfig, testNotification } from "@/lib/actions";
import {
  ProjectNotificationSettings,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_DESCRIPTIONS,
  ALL_EVENT_TYPES,
  SlackNotificationEventType,
} from "@/lib/slack-notification-constants";

interface NotificationsClientProps {
  initialSettings: ProjectNotificationSettings[];
}

export function NotificationsClient({ initialSettings }: NotificationsClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialSettings.length > 0 ? initialSettings[0].projectId : ""
  );
  const [updating, setUpdating] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ key: string; success: boolean; message: string } | null>(null);

  const selectedProject = settings.find((s) => s.projectId === selectedProjectId);

  const getConfigForEvent = (
    projectConfigs: ProjectNotificationSettings["configs"],
    eventType: SlackNotificationEventType
  ) => {
    return projectConfigs.find((c) => c.eventType === eventType);
  };

  const handleToggle = async (
    projectId: string,
    eventType: SlackNotificationEventType,
    channel: "public" | "internal",
    currentValue: boolean
  ) => {
    const key = `${projectId}-${eventType}-${channel}`;
    setUpdating(key);

    const projectSetting = settings.find((s) => s.projectId === projectId);
    if (!projectSetting) return;

    const existingConfig = getConfigForEvent(projectSetting.configs, eventType);
    
    const sendToPublic = channel === "public" ? !currentValue : (existingConfig?.sendToPublic ?? false);
    const sendToInternal = channel === "internal" ? !currentValue : (existingConfig?.sendToInternal ?? false);

    const result = await updateNotificationConfig(
      projectId,
      eventType,
      sendToPublic,
      sendToInternal
    );

    if (result.data) {
      setSettings((prev) =>
        prev.map((s) => {
          if (s.projectId !== projectId) return s;

          const configIndex = s.configs.findIndex((c) => c.eventType === eventType);
          if (configIndex >= 0) {
            const newConfigs = [...s.configs];
            newConfigs[configIndex] = result.data!;
            return { ...s, configs: newConfigs };
          } else {
            return { ...s, configs: [...s.configs, result.data!] };
          }
        })
      );
    }

    setUpdating(null);
  };

  const handleTest = async (
    projectId: string,
    eventType: SlackNotificationEventType
  ) => {
    const key = `${projectId}-${eventType}`;
    setTesting(key);
    setTestResult(null);

    const result = await testNotification(projectId, eventType);

    if (result.error) {
      setTestResult({ key, success: false, message: result.error });
    } else if (result.data) {
      setTestResult({ key, success: true, message: result.data.message });
    }

    setTesting(null);

    setTimeout(() => {
      setTestResult((prev) => (prev?.key === key ? null : prev));
    }, 5000);
  };

  const getActiveCount = (configs: ProjectNotificationSettings["configs"]) => {
    return configs.filter((c) => c.sendToPublic || c.sendToInternal).length;
  };

  if (settings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Slack Notifications</h1>
          <p className="text-secondary-600">
            Configure which Slack notifications are sent for each project
          </p>
        </div>
        <Card className="p-8 text-center">
          <FolderKanban className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No projects yet</h3>
          <p className="mt-2 text-secondary-600">
            Create projects first to configure notifications
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Slack Notifications</h1>
          <p className="text-secondary-600">
            Configure which Slack notifications are sent for each project
          </p>
        </div>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium text-secondary-700">Select Project:</Label>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {settings.map((project) => (
              <SelectItem key={project.projectId} value={project.projectId}>
                <div className="flex items-center gap-2">
                  <FolderKanban className="size-4 text-secondary-500" />
                  <span>{project.projectName}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {getActiveCount(project.configs)}/{ALL_EVENT_TYPES.length}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Project Notifications */}
      {selectedProject && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                  <FolderKanban className="size-5 text-primary-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedProject.projectName}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-4">
                    <span className="text-xs">
                      Configure which events trigger Slack notifications
                    </span>
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Bell className="size-3" />
                {getActiveCount(selectedProject.configs)} / {ALL_EVENT_TYPES.length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-secondary-100">
              {ALL_EVENT_TYPES.map((eventType) => {
                const config = getConfigForEvent(selectedProject.configs, eventType);
                const sendToPublic = config?.sendToPublic ?? false;
                const sendToInternal = config?.sendToInternal ?? false;
                const publicKey = `${selectedProject.projectId}-${eventType}-public`;
                const internalKey = `${selectedProject.projectId}-${eventType}-internal`;

                return (
                  <div
                    key={eventType}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-secondary-900">
                          {EVENT_TYPE_LABELS[eventType]}
                        </span>
                        {(sendToPublic || sendToInternal) && (
                          <CheckCircle2 className="size-4 text-success-600" />
                        )}
                      </div>
                      <p className="text-sm text-secondary-500">
                        {EVENT_TYPE_DESCRIPTIONS[eventType]}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={publicKey}
                          className="text-sm text-secondary-700"
                        >
                          Public
                        </Label>
                        <Switch
                          id={publicKey}
                          checked={sendToPublic}
                          disabled={updating === publicKey}
                          onCheckedChange={() =>
                            handleToggle(
                              selectedProject.projectId,
                              eventType,
                              "public",
                              sendToPublic
                            )
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={internalKey}
                          className="text-sm text-secondary-700"
                        >
                          Internal
                        </Label>
                        <Switch
                          id={internalKey}
                          checked={sendToInternal}
                          disabled={updating === internalKey}
                          onCheckedChange={() =>
                            handleToggle(
                              selectedProject.projectId,
                              eventType,
                              "internal",
                              sendToInternal
                            )
                          }
                        />
                      </div>

                      {/* Test Button */}
                      {(sendToPublic || sendToInternal) && (
                        <div className="flex items-center gap-2">
                          {testResult?.key === `${selectedProject.projectId}-${eventType}` ? (
                            <span
                              className={`text-xs ${
                                testResult.success ? "text-success-600" : "text-danger-600"
                              }`}
                            >
                              {testResult.message}
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={testing === `${selectedProject.projectId}-${eventType}`}
                              onClick={() => handleTest(selectedProject.projectId, eventType)}
                              className="h-7 gap-1 text-xs"
                            >
                              {testing === `${selectedProject.projectId}-${eventType}` ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              Test
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
