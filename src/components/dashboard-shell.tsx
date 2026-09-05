"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar";
import TopNav from "@/components/top-nav";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white">
      {/* Load Font Awesome only for authenticated dashboard sessions */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />
      {/* Desktop & Mobile Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#F8FAFC]">
        <TopNav
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
