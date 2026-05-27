import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { getUserPermissions, hasPageAccess } from "@/lib/permissions";
import { getRoles } from "@/lib/fetchers";
import { RolesClient } from "./client";

export default async function RolesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/");

  const permissions = await getUserPermissions(user.id);
  if (!hasPageAccess(permissions, "roles")) {
    redirect("/dashboard");
  }

  const rolesResult = await getRoles();

  const roles = (rolesResult.data || []).map((role) => ({
    ...role,
    permissions: role.permissions as unknown as import("@/config/permissions").Permissions,
  }));

  return <RolesClient roles={roles} />;
}
