import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import DashboardShell from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <DashboardShell>{children}</DashboardShell>;
}

