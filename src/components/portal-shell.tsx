import Link from "next/link";
import { signOut } from "@/auth";
import type { CurrentUser } from "@/lib/auth-helpers";
import { getPortal } from "@/lib/portals";
import { t } from "@/lib/i18n";
import NotificationBell from "@/components/notification-bell";

export default function PortalShell({
  portal,
  user,
  children,
}: {
  portal: string;
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const def = getPortal(portal);
  const meta = def ? { label: def.label, icon: def.icon, tint: def.tint } : { label: portal, icon: "fa-briefcase", tint: "bg-slate-700" };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 ${meta.tint} text-white rounded-lg flex items-center justify-center text-sm`}>
              <i className={`fa-solid ${meta.icon}`} />
            </div>
            <span className="font-bold text-slate-900">{meta.label}</span>
            <span className="text-xs text-slate-400 hidden sm:inline">{t("portal.potensiCreative")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-blue-600 transition">
              {t("common.adminApp")}
            </Link>
            <span className="text-sm text-slate-600 hidden sm:inline">{user.email}</span>
            <NotificationBell />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}