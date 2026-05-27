import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getProjects } from "@/lib/fetchers";
import { getUserPermissions, hasPageAccess } from "@/lib/permissions";
import { ProjectsClient } from "./client";

export default async function ProjectsPage() {
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

  const projectsResult = await getProjects();

  return (
    <Suspense fallback={null}>
      <ProjectsClient projects={projectsResult.data || []} />
    </Suspense>
  );
}
