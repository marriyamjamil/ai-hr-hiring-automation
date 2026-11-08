import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CodeXml,
  Database,
  Eye,
  HeartHandshake,
  Lightbulb,
  Lock,
  Rocket,
  Scale,
  Server,
  Target,
  Workflow,
} from "lucide-react";

import { Footer } from "@/components/site/footer";
import { Navbar } from "@/components/site/navbar";
import { Reveal } from "@/components/site/reveal";
import { photos } from "@/lib/images";

export const metadata: Metadata = {
  title: "About - HireAI",
  description: "Why we built HireAI, the values behind it, and how it keeps hiring fair.",
};

const values = [
  { icon: HeartHandshake, title: "People first", text: "Technology should give recruiters more time with candidates, not replace the conversation." },
  { icon: Eye, title: "Radical transparency", text: "If the AI gives a score, it must show its working. No black boxes in hiring." },
  { icon: Lightbulb, title: "Simple by default", text: "Powerful tools that an HR team can learn in an afternoon, without a manual." },
  { icon: Rocket, title: "Always improving", text: "We learn from every hiring round and make the next one smoother." },
];

const principles = [
  { icon: Scale, title: "Fairness", text: "One rubric per job, applied to everyone. Personal traits such as names, photos, age, gender and nationality are never scored." },
  { icon: Lock, title: "Privacy", text: "Candidate data is stored securely, seen only by signed-in team members, and never used to train AI models." },
  { icon: BadgeCheck, title: "Human approval", text: "Job posts, shortlists, rejections and interviews all require a person to approve them first." },
  { icon: Eye, title: "Explainability", text: "Every score includes evidence quoted from the resume and a list of anything unclear." },
];

const timeline = [
  { step: "Agent 0", title: "JD Generator", text: "Turns a short brief into a full job description, rubric and screening questions.", done: true },
  { step: "Agent 1", title: "Resume Scorer", text: "Reads PDF and Word CVs and scores them against the approved rubric.", done: true },
  { step: "Agent 2", title: "Screening Calls", text: "A voice agent that runs short, friendly first-round calls.", done: false },
  { step: "Agent 3", title: "Interview Scheduler", text: "Finds times that suit everyone and sends the invites.", done: false },
];

const stack = [
  { icon: CodeXml, name: "Next.js + TypeScript", text: "Modern, fast website" },
  { icon: Server, name: "FastAPI (Python)", text: "Secure backend API" },
  { icon: Database, name: "SQLAlchemy + SQL", text: "Reliable data storage" },
  { icon: BrainCircuit, name: "Azure OpenAI", text: "The AI behind the agents" },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />

      <main className="overflow-hidden">
        {/* ================= HERO ================= */}
        <section className="relative pt-32 pb-16 sm:pt-40">
          <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div className="absolute top-0 right-1/4 -z-10 size-[28rem] animate-aurora rounded-full bg-violet-300/30 blur-3xl" />
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Reveal>
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">About HireAI</p>
              <h1 className="mt-4 font-display text-5xl leading-tight font-extrabold tracking-tight sm:text-6xl">
                We believe hiring should be{" "}
                <span className="bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                  fast, fair and human
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                HR teams spend days on work a machine can do in minutes, while great candidates wait. HireAI was built
                to fix that, without ever taking the final decision away from people.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ================= PHOTO COLLAGE ================= */}
        <section className="px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto grid max-w-7xl grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-2">
            <div className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-3xl md:aspect-auto">
              <Image src={photos.teamLaptops} alt="A team working together on laptops" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-3xl">
              <Image src={photos.highFive} alt="Colleagues celebrating" fill sizes="25vw" className="object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-3xl">
              <Image src={photos.diverseTeam} alt="A diverse team at their desks" fill sizes="25vw" className="object-cover transition-transform duration-700 hover:scale-105" />
            </div>
            <div className="col-span-2 flex flex-col justify-center rounded-3xl bg-linear-to-br from-indigo-600 to-violet-700 p-8 text-white">
              <p className="font-display text-4xl font-extrabold">4 agents</p>
              <p className="mt-2 text-indigo-100">working as one hiring team, with a human approving every step.</p>
            </div>
          </Reveal>
        </section>

        {/* ================= MISSION ================= */}
        <section id="mission" className="scroll-mt-20 py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <Reveal>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                <Target className="size-6" />
              </span>
              <h2 className="mt-6 font-display text-4xl font-bold tracking-tight">Our mission</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                To give every HR team an AI assistant that handles the repetitive parts of hiring, from writing the
                job post to booking the interview, so recruiters can focus on what people do best: understanding
                people.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                And to do it responsibly. Every candidate deserves to be judged on their skills and experience,
                consistently, and to have a person make the final call.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl">
                <Image src={photos.presentation} alt="A team discussing hiring plans" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= VALUES ================= */}
        <section id="values" className="scroll-mt-20 bg-muted/40 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">Our values</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">What we stand for</h2>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {values.map((value, i) => (
                <Reveal key={value.title} delay={i * 100}>
                  <div className="group h-full rounded-3xl border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition-transform group-hover:scale-110">
                      <value.icon className="size-6" />
                    </span>
                    <h3 className="mt-5 font-display text-lg font-bold">{value.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= RESPONSIBLE AI PRINCIPLES ================= */}
        <section id="principles" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-5">
              <Reveal className="lg:col-span-2">
                <p className="text-sm font-semibold tracking-widest text-indigo-600 uppercase">Responsible AI</p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">Four promises built into the product</h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  These aren&apos;t settings you can forget to turn on. They are part of how HireAI works.
                </p>
                <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-3xl">
                  <Image src={photos.interview} alt="A respectful interview conversation" fill sizes="(min-width: 1024px) 420px, 100vw" className="object-cover" />
                </div>
              </Reveal>
              <div className="grid gap-5 sm:grid-cols-2 lg:col-span-3">
                {principles.map((p, i) => (
                  <Reveal key={p.title} delay={i * 100}>
                    <div className="h-full rounded-3xl border bg-card p-7">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                        <p.icon className="size-5" />
                      </span>
                      <h3 className="mt-5 font-display text-lg font-bold">{p.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= ROADMAP TIMELINE ================= */}
        <section className="bg-zinc-950 py-24 text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <p className="text-sm font-semibold tracking-widest text-indigo-400 uppercase">Our journey</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Building the agents, one by one</h2>
            </Reveal>
            <ol className="relative mt-14 space-y-10 border-l border-white/15 pl-8">
              {timeline.map((item, i) => (
                <li key={item.step} className="relative">
                  <Reveal delay={i * 100}>
                    <span
                      className={`absolute top-1 -left-[41px] flex size-5 items-center justify-center rounded-full ring-4 ring-zinc-950 ${
                        item.done ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-indigo-400">{item.step}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.done ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-zinc-300"
                        }`}
                      >
                        {item.done ? "Live" : "Coming soon"}
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-2xl font-bold">{item.title}</h3>
                    <p className="mt-1 text-zinc-400">{item.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ================= TECH STACK ================= */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                <Workflow className="size-6" />
              </span>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight">Built with modern technology</h2>
              <p className="mt-3 text-muted-foreground">Reliable, secure tools used by companies around the world.</p>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stack.map((tech, i) => (
                <Reveal key={tech.name} delay={i * 100}>
                  <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <tech.icon className="size-6 text-indigo-600" />
                    </span>
                    <div>
                      <p className="font-semibold">{tech.name}</p>
                      <p className="text-sm text-muted-foreground">{tech.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal className="mt-16 text-center">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground shadow-xl shadow-indigo-500/30 transition-transform hover:scale-105"
              >
                Open the workspace <ArrowRight className="size-4" />
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
