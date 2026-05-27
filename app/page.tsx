import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { HomeClient } from "./client";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return <HomeClient authError={params.error} />;
}
