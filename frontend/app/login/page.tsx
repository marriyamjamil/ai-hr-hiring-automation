"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Sparkles, Star } from "lucide-react";

import { ScoreRing } from "@/components/shared/score-ring";
import { Logo } from "@/components/site/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";
import { photos, portraits } from "@/lib/images";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stop the browser from reloading the page
    setError("");

    // Quick checks before asking the server
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- LEFT: big photo with floating cards (hidden on phones) ---------- */}
      <section className="relative hidden overflow-hidden lg:block">
        <Image src={photos.diverseTeam} alt="An HR team at work" fill preload sizes="55vw" className="object-cover" />
        <div className="absolute inset-0 bg-linear-to-br from-indigo-950/90 via-indigo-900/70 to-violet-900/60" />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo light />

          <div className="max-w-lg">
            <h1 className="font-display text-5xl leading-tight font-extrabold tracking-tight">
              Hire faster.
              <br />
              <span className="bg-linear-to-r from-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">Hire fairer.</span>
            </h1>
            <p className="mt-4 text-lg text-indigo-100">
              Your AI hiring team writes the job posts and scores the CVs. You make every final decision.
            </p>

            {/* Floating glass cards */}
            <div className="mt-10 flex flex-wrap gap-4">
              <div className="flex animate-float items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                <div className="rounded-full bg-white">
                  <ScoreRing score={92} size={52} stroke={5} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Top candidate</p>
                  <p className="text-xs text-indigo-200">Ranked #1 of 38</p>
                </div>
              </div>
              <div className="flex animate-float-slow items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md [animation-delay:-2s]">
                <span className="flex size-11 items-center justify-center rounded-full bg-violet-500/40">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Job post generated</p>
                  <p className="text-xs text-indigo-200">Ready for your approval</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sample quote */}
          <figure className="max-w-lg rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur-md">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="mt-3 text-sm leading-relaxed text-indigo-50">
              &ldquo;The shortlist is waiting for us on Monday morning, with the reasons behind every score.&rdquo;
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <Image src={portraits.amara} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
              <div className="text-xs">
                <p className="font-semibold">Amara Okafor</p>
                <p className="text-indigo-200">Head of People, Brightpath</p>
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---------- RIGHT: the login form ---------- */}
      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to website
        </Link>

        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="mt-8 space-y-2 lg:mt-0">
            <h2 className="font-display text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your HireAI workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="h-12 rounded-xl bg-background pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-12 rounded-xl bg-background pr-11 pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-base shadow-lg shadow-indigo-500/30 hover:opacity-95"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3 rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
            Accounts are created by your administrator. There is no public sign-up.
          </div>
        </div>
      </section>
    </main>
  );
}
