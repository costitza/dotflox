"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileCode,
  GitGraph,
  Mic,
  Users,
  AudioLines,
} from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold tracking-tight text-[#2563eb]">
              .flux
            </span>
          </div>

          {/* Center links */}
          <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-900">
              Pricing
            </a>
            <a href="#docs" className="hover:text-slate-900">
              Docs
            </a>
          </div>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button
                  variant="ghost"
                  className="hidden h-9 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 md:inline-flex"
                >
                  Sign In
                </Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button className="h-9 rounded-full bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 hover:bg-[#1d4ed8]">
                  Get Started
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button className="h-9 rounded-full bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 hover:bg-[#1d4ed8]">
                  Go to Dashboard
                </Button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.10),transparent_60%)]" />

          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 lg:flex-row lg:items-center lg:px-8 lg:pb-24 lg:pt-16">
            {/* Hero text */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex-1 space-y-6"
            >
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-tight lg:text-6xl">
                Capture the pulse of your
                <br />
                <span className="g-linear-to-br from-[#2563eb] to-[#1d4ed8] bg-clip-text text-transparent">
                  code and conversation.
                </span>
              </h1>

              <p className="max-w-xl text-balance text-base text-slate-600 sm:text-lg">
                The all-in-one intelligence dashboard. Connect your GitHub
                repository to track PRs, profile contributor growth, and
                auto-summarize technical meetings with AI.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button className="h-11 rounded-full bg-[#2563eb] px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-[#1d4ed8]">
                      Analyze My Repo
                      <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard">
                    <Button className="h-11 rounded-full bg-[#2563eb] px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-[#1d4ed8]">
                      Analyze My Repo
                      <ArrowRight className="ml-1.5 size-4" />
                    </Button>
                  </Link>
                </SignedIn>

                <Button
                  variant="outline"
                  className="h-11 rounded-full border-[#2563eb] bg-white px-6 text-sm font-semibold text-[#2563eb] hover:bg-blue-50"
                >
                  View Demo
                </Button>
              </div>
            </motion.div>

            {/* Hero visual - dashboard screenshot */}
            <motion.div
              initial={{ opacity: 0, y: 24, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: -4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="flex-1"
            >
              <div className="relative mx-auto max-w-lg">
                <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-linear-to-br from-blue-100/70 via-slate-50 to-blue-50/80 opacity-80 blur-2xl" />

                <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white shadow-xl shadow-slate-200/80">
                  {/* Window chrome */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
                      PR Velocity vs Meeting Frequency
                    </span>
                    <div className="h-4 w-10 rounded-md bg-slate-100" />
                  </div>

                  <CardContent className="grid gap-4 bg-slate-50/40 p-4 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    {/* Sidebar */}
                    <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 text-xs shadow-sm">
                      <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Navigation
                      </span>
                      {["Repository", "Analysis", "Call History", "Settings"].map(
                        (item) => (
                          <button
                            key={item}
                            className={cn(
                              "flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium transition",
                              item === "Call History"
                                ? "bg-blue-50 text-[#2563eb]"
                                : "text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            <span>{item}</span>
                            {item === "Call History" && (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                Live
                              </span>
                            )}
                          </button>
                        ),
                      )}
                    </div>

                    {/* Graph + detail */}
                    <div className="space-y-3 rounded-2xl bg-white/80 p-3 shadow-sm">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">
                            PR Velocity
                          </span>
                          <span className="text-slate-500">
                            Last 7 days · +18%
                          </span>
                        </div>
                        <div className="relative mt-1 h-24 rounded-lg g-linear-to-br from-blue-50 via-slate-50 to-blue-100">
                          <div className="absolute inset-x-2 bottom-2 flex items-end gap-1.5">
                            {[30, 55, 40, 70, 65, 50, 80].map((height, idx) => (
                              <div
                                key={idx}
                                className="flex-1 rounded-full bg-[#2563eb]/80"
                                style={{ height: `${height}%` }}
                              />
                            ))}
                          </div>
                          <div className="absolute inset-x-2 top-3 flex justify-between text-[9px] text-slate-400">
                            <span>M</span>
                            <span>T</span>
                            <span>W</span>
                            <span>T</span>
                            <span>F</span>
                            <span>S</span>
                            <span>S</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] text-slate-600">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">
                            Meeting Frequency
                          </span>
                          <span className="text-slate-500">This week</span>
                        </div>
                        <ul className="space-y-1.5">
                          <li>Architecture sync · 45 min · 2 decisions logged</li>
                          <li>Release planning · 30 min · 3 PRs linked</li>
                          <li>Incident review · 25 min · RCA attached</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Social proof / tech stack */}
        <section className="bg-slate-50 py-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-400">
              INTEGRATED WITH MODERN WORKFLOWS
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-70">
              <LogoIcon src="/file.svg" alt="GitHub logo" label="GitHub" />
              <LogoIcon src="/window.svg" alt="ElevenLabs logo" label="ElevenLabs" />
              <LogoIcon src="/globe.svg" alt="Convex logo" label="Convex" />
              <LogoIcon src="/next.svg" alt="Next.js logo" label="Next.js" />
            </div>
          </div>
        </section>

        {/* Core Features grid */}
        <section
          id="features"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <div className="mb-8 max-w-3xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Understand the full engineering workflow.
            </h2>
            <p className="text-sm text-slate-600 sm:text-base">
              From code to calls, every signal is captured and mapped to your
              repository timeline.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FeatureCard
              icon={GitGraph}
              title="Deep Repo Analysis"
              description="Instant architectural overview. Map your file structure, tech stack, and module dependencies in seconds."
            />
            <FeatureCard
              icon={Users}
              title="Contributor Profiling"
              description="Go beyond commit counts. AI analyzes code complexity to profile seniority and expertise across your stack."
            />
            <FeatureCard
              icon={FileCode}
              title="Intelligent PR Audit"
              description="Automated AI reviews for every Pull Request. Catch logic errors and style issues before they merge."
            />
            <FeatureCard
              icon={Mic}
              title="Voice-to-Code Sync"
              description="Record technical meetings. AI summarizes decisions and links audio context directly to repo changes."
            />
          </div>
        </section>

        {/* Audio differentiator */}
        <section className="bg-[#2563eb] text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Don&apos;t let context vanish into thin air.
              </h2>
              <p className="text-sm text-blue-100 sm:text-base">
                Technical decisions happen in meetings, not just in code. .flux
                listens to your engineering calls (powered by ElevenLabs),
                summarizes the architecture decisions, and saves them alongside
                your repository history.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <Card className="w-full max-w-md rounded-3xl border-blue-300/30 bg-blue-500/10 text-white shadow-xl shadow-blue-900/30">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-blue-600/60">
                      <AudioLines className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm text-white">
                        Architecture Sync · 42 min
                      </CardTitle>
                      <CardDescription className="text-[11px] text-blue-100">
                        Auto-recorded · Linked to repo /platform
                      </CardDescription>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
                    AI Summary
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Waveform */}
                  <div className="flex h-16 items-end gap-1 rounded-xl bg-blue-900/40 px-3 pb-2 pt-3">
                    {[20, 35, 50, 70, 55, 40, 25, 60, 45, 30, 15].map(
                      (height, idx) => (
                        <div
                          key={idx}
                          className="w-1 rounded-full bg-blue-200"
                          style={{ height: `${height}%` }}
                        />
                      ),
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-blue-50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                      Key decisions
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      <li>• Adopt service boundary between billing and usage.</li>
                      <li>• Migrate legacy cron jobs into Convex scheduled funcs.</li>
                      <li>
                        • Create follow-up PRs for auth middleware and rate limiting.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              How it works in three steps.
            </h2>
          </div>

          <div className="grid gap-6 text-sm text-slate-700 md:grid-cols-3">
            <StepCard
              step="01"
              title="Connect"
              description="Sign in with GitHub and select the repositories you want .flux to watch."
            />
            <StepCard
              step="02"
              title="Listen"
              description="Invite the .flux bot to your next sync or upload audio recordings from your meetings."
            />
            <StepCard
              step="03"
              title="Analyze"
              description="Watch as PRs are graded and meeting notes are mapped to your project timeline."
            />
          </div>
        </section>

        {/* Pricing / value */}
        <section
          id="pricing"
          className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8"
        >
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Simple, Usage-Based Scaling.
            </h2>
          </div>

          <div className="flex justify-center">
            <Card className="w-full max-w-md rounded-3xl shadow-lg shadow-slate-200/80">
              <CardHeader className="pb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pro Plan
                </p>
                <CardTitle className="text-xl text-slate-900">
                  Built for teams preparing for the big presentation.
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• Unlimited Repo Analysis</li>
                  <li>• 5 Hours of Audio Transcription per month</li>
                  <li>• 100 PR Analyses included</li>
                </ul>
                <Button className="mt-2 h-11 w-full rounded-full bg-[#2563eb] text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:bg-[#1d4ed8]">
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Docs anchor copy */}
        <section
          id="docs"
          className="mx-auto max-w-6xl px-4 pb-12 text-xs text-slate-500 sm:px-6 lg:px-8"
        >
          <p>
            Docs and SDKs are coming soon. Connect your GitHub today and start
            streaming live engineering context into .flux.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <span>Copyright © 2024 .flux</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-900">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-900">
              Terms
            </a>
            <a href="#" className="hover:text-slate-900">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

type FeatureCardProps = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card className="h-full rounded-2xl border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:border-[#2563eb] hover:shadow-lg hover:shadow-blue-200/60">
      <CardHeader className="pb-3">
        <div className="mb-3 inline-flex size-9 items-center justify-center rounded-full bg-blue-50 text-[#2563eb]">
          <Icon className="size-4" />
        </div>
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <CardDescription className="text-sm text-slate-600">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

type StepCardProps = {
  step: string;
  title: string;
  description: string;
};

function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-600">{description}</p>
    </div>
  );
}

type LogoIconProps = {
  src: string;
  alt: string;
  label: string;
};

function LogoIcon({ src, alt, label }: LogoIconProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
      <div className="opacity-50 transition hover:opacity-100">
        <Image src={src} alt={alt} width={32} height={32} />
      </div>
      <span>{label}</span>
    </div>
  );
}

