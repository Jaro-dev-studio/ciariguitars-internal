import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  DEFAULT_VIEWER_PERMISSIONS,
} from "../config/permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Creating system roles...");

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { permissions: DEFAULT_ADMIN_PERMISSIONS as any },
    create: {
      name: "Admin",
      description: "Full access to all resources and pages",
      isSystem: true,
      permissions: DEFAULT_ADMIN_PERMISSIONS as any,
    },
  });

  const memberRole = await prisma.role.upsert({
    where: { name: "Member" },
    update: { permissions: DEFAULT_MEMBER_PERMISSIONS as any },
    create: {
      name: "Member",
      description: "Standard access to tasks and recurring tasks",
      isSystem: true,
      permissions: DEFAULT_MEMBER_PERMISSIONS as any,
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: "Viewer" },
    update: { permissions: DEFAULT_VIEWER_PERMISSIONS as any },
    create: {
      name: "Viewer",
      description: "Read-only access to tasks",
      isSystem: true,
      permissions: DEFAULT_VIEWER_PERMISSIONS as any,
    },
  });

  console.log("[Seed] System roles created:", { adminRole: adminRole.id, memberRole: memberRole.id, viewerRole: viewerRole.id });

  const roleMap: Record<string, string> = {
    ADMIN: adminRole.id,
    MEMBER: memberRole.id,
    VIEWER: viewerRole.id,
  };

  const usersWithoutRole = await prisma.user.findMany({
    where: { roleId: null },
  });

  console.log(`[Seed] Migrating ${usersWithoutRole.length} users to role-based system...`);

  for (const user of usersWithoutRole) {
    const roleId = roleMap[user.role];
    if (roleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId },
      });
      console.log(`[Seed] Assigned user ${user.email} (${user.role}) -> roleId ${roleId}`);
    }
  }

  console.log("[Seed] Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
