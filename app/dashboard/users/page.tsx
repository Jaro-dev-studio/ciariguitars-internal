import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getUsers, getProjects } from "@/lib/fetchers";
import prisma from "@/lib/prisma";
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

  const [usersResult, projectsResult] = await Promise.all([
    getUsers(),
    getProjects(),
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
    />
  );
}
