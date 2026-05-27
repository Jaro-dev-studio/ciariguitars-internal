import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getUsers, getProjects, getRoles } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
import { getUserPermissions, hasPageAccess } from "@/lib/permissions";
import { UsersClient } from "./client";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser) redirect("/");

  const permissions = await getUserPermissions(currentUser.id);
  if (!hasPageAccess(permissions, "users")) {
    redirect("/dashboard");
  }

  const [usersResult, projectsResult, rolesResult] = await Promise.all([
    getUsers(),
    getProjects(),
    getRoles(),
  ]);

  const projects = (projectsResult.data || []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <UsersClient
      users={usersResult.data || []}
      currentUserId={currentUser.id}
      projects={projects}
      roles={rolesResult.data || []}
    />
  );
}
