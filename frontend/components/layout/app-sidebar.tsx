"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, Briefcase, CalendarClock, Globe, LayoutDashboard, LogOut, Mail, Settings, Sparkles, Users } from "lucide-react";

import { useAuth } from "@/components/auth-provider";

// The menu links (add a line here to add a page to the sidebar)
export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/interviewers", label: "Interviewers", icon: CalendarClock },
  { href: "/outbox", label: "Outbox", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
];

// "Marriyam Jamil" → "MJ"
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

// The inside of the sidebar (used on desktop AND in the phone menu)
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-400">
      {/* Soft glow in the corner */}
      <div className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-indigo-600/30 blur-3xl" />

      {/* Logo */}
      <Link href="/dashboard" onClick={onNavigate} className="relative flex h-18 items-center gap-2.5 px-6 font-display text-lg font-bold text-white">
        <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
          <BrainCircuit className="size-5" />
        </span>
        Hire<span className="-ml-2.5 text-indigo-400">AI</span>
      </Link>

      {/* Menu links */}
      <nav className="relative flex-1 space-y-1 px-4 py-4">
        <p className="px-3 pb-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">Workspace</p>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/50"
                  : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className={`size-4.5 ${active ? "" : "text-zinc-500 group-hover:text-indigo-300"}`} />
              {item.label}
            </Link>
          );
        })}

        <p className="px-3 pt-8 pb-3 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">More</p>
        <Link href="/" className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all hover:bg-white/5 hover:text-white">
          <Globe className="size-4.5 text-zinc-500 group-hover:text-indigo-300" />
          View website
        </Link>
      </nav>

      {/* Promo card */}
      <div className="relative mx-4 mb-4 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-indigo-600/30 to-fuchsia-600/20 p-4">
        <Sparkles className="size-5 text-indigo-300" />
        <p className="mt-2 text-sm font-semibold text-white">Interview scheduling</p>
        <p className="mt-1 text-xs text-zinc-400">Agent 3 is on the way: it matches candidates with free interviewers.</p>
      </div>

      {/* Logged-in user + sign out */}
      <div className="relative border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-400 to-fuchsia-400 text-sm font-bold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs capitalize">{user.role}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-2 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// The sidebar on big screens (hidden on phones)
export function AppSidebar() {
  return (
    <aside className="hidden w-68 shrink-0 lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent />
      </div>
    </aside>
  );
}
