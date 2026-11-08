import Link from "next/link";
import { Globe, Mail, MessageSquareText, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/site/navbar";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#agents", label: "AI Agents" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/login", label: "Workspace" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/about#mission", label: "Our mission" },
      { href: "/about#values", label: "Values" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Responsible AI",
    links: [
      { href: "/about#principles", label: "Fairness" },
      { href: "/about#principles", label: "Privacy" },
      { href: "/about#principles", label: "Human approval" },
      { href: "/about#principles", label: "Explainability" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-zinc-950 text-zinc-400">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              AI that does the heavy lifting of hiring, from the first job post to the booked interview, while
              people make every final decision.
            </p>
            <div className="mt-6 flex gap-3">
              {[Globe, Mail, MessageSquareText].map((Icon, i) => (
                <span
                  key={i}
                  className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Icon className="size-4" />
                </span>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold text-white">{column.title}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs sm:flex-row">
          <p>© 2026 HireAI. Built as an AI-powered HR hiring automation project.</p>
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400" />
            Every hiring decision is approved by a human.
          </p>
        </div>
      </div>
    </footer>
  );
}
