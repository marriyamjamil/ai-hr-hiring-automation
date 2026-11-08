import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  CloudUpload,
  Eye,
  FileSearch,
  Lock,
  PhoneCall,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCog,
  Zap,
} from "lucide-react";

import { ScoreRing } from "@/components/shared/score-ring";
import { buttonVariants } from "@/components/ui/button";
import { AgentsSlider } from "@/components/site/agents-slider";
import { CountUp } from "@/components/site/count-up";
import { Faq } from "@/components/site/faq";
import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Reveal } from "@/components/site/reveal";
import { RotatingWords } from "@/components/site/rotating-words";
import { TestimonialsSlider } from "@/components/site/testimonials-slider";
import { photos, portraits } from "@/lib/images";

// Sample company names for the logo strip (fictional)
const companies = ["Brightpath", "Lumen Labs", "Cedar Bank", "Orbital", "Vertex Health", "Northwind", "Kite & Co", "Nimbus"];

const stats = [
  { value: 4, suffix: "", label: "AI agents working together" },
  { value: 5, suffix: "", label: "clear criteria behind every score" },
  { value: 100, suffix: "%", label: "of decisions approved by people" },
  { value: 0, suffix: "", label: "personal traits used in scoring" },
];

const steps = [
  { icon: Sparkles, title: "Describe the role", text: "Fill in a short form. The AI drafts the job post, rubric and questions." },
  { icon: CloudUpload, title: "Upload the CVs", text: "Drag in PDFs and Word files. Each one is read and scored in seconds." },
  { icon: PhoneCall, title: "Screen the best", text: "Shortlisted people get a short, friendly AI screening call." },
  { icon: CalendarCheck, title: "Book interviews", text: "Approve the final list and interviews are scheduled for you." },
];

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main className="overflow-hidden">
        {/* ================= HERO ================= */}
        <section className="relative pt-32 pb-20 sm:pt-40 lg:pb-28">
          <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div className="absolute top-0 left-1/4 -z-10 size-[30rem] animate-aurora rounded-full bg-indigo-400/30 blur-3xl" />
          <div className="absolute top-20 right-0 -z-10 size-[26rem] animate-aurora rounded-full bg-fuchsia-300/30 blur-3xl [animation-delay:-6s]" />

          <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur dark:bg-card/70">
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">New</span>
                  AI screening calls are coming soon
                </span>
              </Reveal>

              <Reveal delay={100}>
                <h1 className="mt-6 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                  Your AI hiring team that can
                  <br />
                  <RotatingWords words={["write job posts.", "score resumes.", "screen calls.", "book interviews."]} />
                </h1>
              </Reveal>

              <Reveal delay={200}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  HireAI takes care of the repetitive work of hiring, so your people can spend their time on people.
                  Every step is explained, and every decision stays with you.
                </p>
              </Reveal>

              <Reveal delay={300}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/login" className={`${buttonVariants()} h-12 rounded-full px-7 text-base shadow-xl shadow-indigo-500/30`}>
                    Open workspace
                    <ArrowRight />
                  </Link>
                  <Link href="/#agents" className={`${buttonVariants({ variant: "outline" })} h-12 rounded-full px-7 text-base`}>
                    See it in action
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={400}>
                <div className="mt-10 flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {[portraits.amara, portraits.omar, portraits.sofia, portraits.daniel].map((src) => (
                      <Image key={src} src={src} alt="" width={40} height={40} className="size-10 rounded-full object-cover ring-2 ring-background" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Built for HR teams</span> who want speed without
                    losing the human touch.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* Photo with floating "live" cards */}
            <Reveal delay={200} className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative">
                <div className="absolute -inset-4 rotate-3 rounded-[2.5rem] bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 opacity-90" />
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl">
                  <Image src={photos.recruiter} alt="A recruiter smiling in an office" fill preload sizes="(min-width: 1024px) 520px, 90vw" className="object-cover" />
                </div>

                <div className="absolute top-10 -left-6 animate-float rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur sm:-left-14 dark:bg-zinc-900/95">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={87} size={56} stroke={6} />
                    <div>
                      <p className="text-sm font-semibold">Resume scored</p>
                      <p className="text-xs text-muted-foreground">Strong match · 3 sec</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -right-4 bottom-28 animate-float-slow rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur [animation-delay:-3s] sm:-right-10 dark:bg-zinc-900/95">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-violet-500" /> Job post ready
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Python Developer · waiting for approval</p>
                </div>

                <div className="absolute -bottom-6 left-6 animate-float rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur [animation-delay:-1.5s] dark:bg-zinc-900/95">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CalendarCheck className="size-4" />
                    </span>
                    Interview booked
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Thu 19 Nov, 3:00 PM</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= LOGO STRIP (moving) ================= */}
        <section className="border-y bg-muted/40 py-10">
          <p className="text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Designed for modern HR teams like these
          </p>
          <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
            <div className="flex w-max animate-marquee gap-16 pr-16">
              {[...companies, ...companies].map((name, i) => (
                <span key={i} className="flex items-center gap-2 font-display text-xl font-bold whitespace-nowrap text-muted-foreground/70">
                  <span className="size-6 rounded-md bg-muted-foreground/20" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ================= STATS ================= */}
        <section className="py-20">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className="rounded-3xl border bg-card p-6 text-center transition-shadow hover:shadow-lg">
                  <p className="bg-linear-to-br from-indigo-600 to-fuchsia-500 bg-clip-text font-display text-5xl font-extrabold text-transparent">
                    <CountUp to={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= AGENTS SLIDER ================= */}
        <section id="agents" className="scroll-mt-20 bg-linear-to-b from-indigo-50/80 to-background py-24 dark:from-indigo-950/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">Meet your AI agents</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Four agents. One smooth hiring flow.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Each agent does one job really well, and hands over to the next only when you approve.
              </p>
            </Reveal>
            <Reveal delay={150} className="mt-12">
              <AgentsSlider />
            </Reveal>
          </div>
        </section>

        {/* ================= FEATURES (bento cards) ================= */}
        <section id="features" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">Why teams choose HireAI</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
                Fast where it should be. Careful where it matters.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {/* Big card: explainable scores */}
              <Reveal className="md:col-span-2">
                <div className="group relative h-full overflow-hidden rounded-3xl border bg-linear-to-br from-indigo-600 to-violet-700 p-8 text-white">
                  <div className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-125" />
                  <Eye className="size-8" />
                  <h3 className="mt-4 font-display text-2xl font-bold">Scores you can explain</h3>
                  <p className="mt-2 max-w-md text-indigo-100">
                    Every mark comes with evidence quoted from the resume, so you always know why someone was
                    shortlisted.
                  </p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Required skills", "36/40", "“Built REST APIs with FastAPI and PostgreSQL”"],
                      ["Projects", "17/20", "“Led a team of 3 to ship an internal HR tool”"],
                    ].map(([name, score, quote]) => (
                      <div key={name} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                        <div className="flex justify-between text-sm font-semibold">
                          <span>{name}</span>
                          <span>{score}</span>
                        </div>
                        <p className="mt-2 text-xs text-indigo-100 italic">{quote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={100}>
                <FeatureCard icon={BadgeCheck} title="Human in the loop" text="Nothing reaches a candidate until someone on your team approves it." />
              </Reveal>
              <Reveal>
                <FeatureCard icon={Scale} title="Fair by design" text="Names, photos, age and university prestige are never part of the score." />
              </Reveal>
              <Reveal delay={100}>
                <FeatureCard icon={Lock} title="Private by default" text="CVs stay on your server and are never used to train AI models." />
              </Reveal>
              <Reveal delay={200}>
                <FeatureCard icon={UserCog} title="Roles and access" text="Admins, HR and hiring managers each see exactly what they need." />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how-it-works" className="scroll-mt-20 bg-muted/40 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">How it works</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">From job idea to interview in four steps</h2>
            </Reveal>

            <div className="relative mt-16 grid gap-8 md:grid-cols-4">
              <div className="absolute top-8 right-[12%] left-[12%] hidden h-px bg-linear-to-r from-indigo-300 via-violet-300 to-fuchsia-300 md:block" />
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 120} className="relative text-center">
                  <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border bg-background shadow-lg">
                    <step.icon className="size-7 text-indigo-600" />
                    <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= HUMAN APPROVAL (photo + text) ================= */}
        <section className="py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl">
                <Image src={photos.teamMeeting} alt="An HR team reviewing candidates together" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
              </div>
              <div className="absolute -right-4 -bottom-8 w-72 rounded-2xl border bg-card p-5 shadow-2xl sm:-right-8">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Approval log</p>
                {[
                  ["Job post approved", "Sara · HR"],
                  ["Shortlist of 8 approved", "Bilal · Manager"],
                  ["Interviews confirmed", "Sara · HR"],
                ].map(([title, who]) => (
                  <div key={title} className="mt-3 flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{who}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={150}>
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">Responsible AI</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">AI suggests. People decide.</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Hiring changes lives, so HireAI never acts alone. Clear approval gates sit between every step, and
                each decision is recorded with who made it and when.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: ShieldCheck, text: "Approval gates before anything reaches a candidate" },
                  { icon: FileSearch, text: "Evidence for every score, ready for audits" },
                  { icon: Zap, text: "Unclear CVs go to a person, never auto-rejected" },
                ].map((item) => (
                  <li key={item.text} className="flex items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                      <item.icon className="size-5" />
                    </span>
                    <span className="font-medium">{item.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ================= TESTIMONIALS SLIDER ================= */}
        <section className="relative overflow-hidden bg-zinc-950 py-24">
          <div className="absolute top-0 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-widest text-indigo-400 uppercase">What HR teams say</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Less admin. Better hires.</h2>
            </Reveal>
            <div className="mt-12">
              <TestimonialsSlider />
            </div>
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq" className="scroll-mt-20 py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
            <Reveal>
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">FAQ</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">Questions, answered</h2>
              <p className="mt-4 text-muted-foreground">
                Want to know more about how HireAI works and how it keeps hiring fair? Start here.
              </p>
              <Link href="/about" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                Read about our principles <ArrowRight className="size-4" />
              </Link>
            </Reveal>
            <Reveal delay={100} className="lg:col-span-2">
              <Faq />
            </Reveal>
          </div>
        </section>

        {/* ================= CALL TO ACTION ================= */}
        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-indigo-700">
            <Image src={photos.stickyNotes} alt="" fill sizes="100vw" className="object-cover opacity-20 mix-blend-luminosity" />
            <div className="absolute inset-0 bg-linear-to-r from-indigo-700 via-indigo-700/90 to-fuchsia-600/70" />
            <div className="relative px-6 py-16 text-center sm:px-16 sm:py-20">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Ready to hire faster, and fairer?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
                Open your workspace, create your first job with AI, and see your ranked shortlist in minutes.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 font-semibold text-indigo-700 shadow-xl transition-transform hover:scale-105"
              >
                Get started <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: typeof Eye; title: string; text: string }) {
  return (
    <div className="group h-full rounded-3xl border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/10">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
