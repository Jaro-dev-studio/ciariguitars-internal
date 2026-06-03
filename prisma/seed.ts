import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] Ensuring all users have admin access...");

  const result = await prisma.user.updateMany({
    where: { role: { not: "ADMIN" } },
    data: { role: "ADMIN" },
  });

  console.log(`[Seed] Updated ${result.count} user(s) to ADMIN.`);
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
