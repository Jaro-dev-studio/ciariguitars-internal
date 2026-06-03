import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar, SidebarSkeleton } from "./Sidebar";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { CommandPalette } from "@/components/command-palette";
import { getUserPermissions } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/");
  }

  const permissions = await getUserPermissions(user.id);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-grid-pattern pointer-events-none fixed inset-0 opacity-[0.01]" />

      <CommandPalette permissions={permissions} />

      <div className="relative z-10 flex min-h-screen">
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar user={user} permissions={permissions} />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-6 pb-6 pt-16 lg:ml-64 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
