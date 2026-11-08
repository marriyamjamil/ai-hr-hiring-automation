"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { AuthProvider } from "@/components/auth-provider";
import { AppSidebar, SidebarContent } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";

// The frame around every admin page: guard + sidebar + top bar
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-background">
        <AppSidebar />

        {/* Phone menu: slides over the page when the menu button is pressed */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative h-full w-72 shadow-xl">
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="absolute top-5 right-3 z-10 rounded-md p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
