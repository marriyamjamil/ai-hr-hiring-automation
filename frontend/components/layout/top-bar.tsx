"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Plus, Search } from "lucide-react";

import { initials, navItems } from "@/components/layout/app-sidebar";
import { useAuth } from "@/components/auth-provider";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const current = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      {/* Menu button (phones only) */}
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-lg p-2 transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Workspace</p>
        <p className="truncate font-display font-bold">{current?.label ?? "HireAI"}</p>
      </div>

      {/* Search (visual for now; it will search jobs and candidates later) */}
      <div className="relative mx-auto hidden w-full max-w-md md:block">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search jobs, candidates..."
          className="h-10 w-full rounded-full border bg-muted/50 pr-4 pl-10 text-sm outline-none transition focus:border-indigo-300 focus:bg-background focus:ring-4 focus:ring-indigo-500/10"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <button aria-label="Notifications" className="relative rounded-full p-2.5 transition-colors hover:bg-muted">
          <Bell className="size-5 text-muted-foreground" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-fuchsia-500 ring-2 ring-background" />
        </button>
        <Link
          href="/jobs/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">New job</span>
        </Link>
        <div className="ml-1 hidden size-10 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-fuchsia-400 text-sm font-bold text-white sm:flex">
          {initials(user.name)}
        </div>
      </div>
    </header>
  );
}
