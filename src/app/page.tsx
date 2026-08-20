import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const role = user.role;
  if (role === "STREAMER") {
    redirect("/streamer-dashboard");
  } else if (role === "STAFF" || role === "OTS") {
    redirect("/staff-dashboard");
  } else if (role === "FINANCE" || role === "FINANCE_MANAGER") {
    redirect("/portal/finance");
  } else if (role === "QC_MANAGER" || role === "QC_REVIEWER") {
    redirect("/portal/qc");
  } else if (role === "TRAINER") {
    redirect("/portal/trainer");
  } else if (role === "CLIENT") {
    redirect("/portal/client");
  } else if (role === "OPERATION") {
    redirect("/portal/operation");
  }

  redirect("/dashboard");
}
