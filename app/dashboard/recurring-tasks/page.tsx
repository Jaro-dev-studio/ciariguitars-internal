import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getRecurringTasks } from "@/lib/fetchers";
import { getProjects, getAssignableUsers } from "@/lib/fetchers";
import { getUserPermissions, hasPageAccess } from "@/lib/permissions";
import { RecurringTasksClient } from "./client";

export default async function RecurringTasksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/");

  const permissions = await getUserPermissions(user.id);
  if (!hasPageAccess(permissions, "recurringTasks")) {
    redirect("/dashboard");
  }

  const [recurringTasksResult, projectsResult, usersResult] = await Promise.all([
    getRecurringTasks(),
    getProjects(),
    getAssignableUsers(),
  ]);

  return (
    <Suspense fallback={null}>
      <RecurringTasksClient
        recurringTasks={recurringTasksResult.data || []}
        projects={projectsResult.data || []}
        users={usersResult.data || []}
      />
    </Suspense>
  );
}
