import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getProject, getTasksByProject, getAssignableUsers } from "@/lib/fetchers";
import { getUserPermissions, hasPageAccess } from "@/lib/permissions";
import { ProjectDetailClient } from "./client";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/");

  const permissions = await getUserPermissions(user.id);
  if (!hasPageAccess(permissions, "projects")) {
    redirect("/dashboard");
  }

  const [projectResult, tasksResult, usersResult] = await Promise.all([
    getProject(id),
    getTasksByProject(id),
    getAssignableUsers(),
  ]);

  if (!projectResult.data) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <ProjectDetailClient
        project={projectResult.data}
        tasks={tasksResult.data || []}
        allUsers={usersResult.data || []}
      />
    </Suspense>
  );
}
