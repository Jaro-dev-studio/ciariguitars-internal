import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getTasks, getAssignableUsers, getProjects } from "@/lib/fetchers";
import { getTaskViews } from "@/lib/actions";
import { getUserPermissions, hasPageAccess } from "@/lib/permissions";
import { TasksClient } from "./client";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/");

  const permissions = await getUserPermissions(user.id);
  if (!hasPageAccess(permissions, "tasks")) {
    redirect("/dashboard");
  }

  const [tasksResult, projectsResult, usersResult, taskViewsResult] = await Promise.all([
    getTasks(),
    getProjects(),
    getAssignableUsers(),
    getTaskViews(),
  ]);

  return (
    <Suspense fallback={null}>
      <TasksClient
        tasks={tasksResult.data || []}
        projects={projectsResult.data || []}
        users={usersResult.data || []}
        savedViews={taskViewsResult.data || []}
      />
    </Suspense>
  );
}
