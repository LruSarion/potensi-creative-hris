import { redirect } from "next/navigation";
import { requirePortal, type Portal } from "@/lib/auth-helpers";
import PortalShell from "@/components/portal-shell";

// Map path segment -> portal name
const SEGMENT_TO_PORTAL: Record<string, Portal> = {
  client: "client",
  streamer: "streamer",
  operation: "operation",
  trainer: "trainer",
  qc: "qc",
  finance: "finance",
};

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portal = SEGMENT_TO_PORTAL[slug];

  if (!portal) {
    redirect("/dashboard");
  }

  const user = await requirePortal(portal).catch(() => null);
  if (!user) redirect("/dashboard");

  return <PortalShell portal={portal} user={user}>{children}</PortalShell>;
}