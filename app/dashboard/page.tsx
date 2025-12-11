"use client";

import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { AddRepoForm } from "@/components/dashboard/add-repo-form";
import { Activity, GitBranch, GitPullRequest, Star } from "lucide-react";

export default function DashboardPage() {
  const { user } = useUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repos = useQuery((api as any).repos?.listForCurrentUser) ?? [];

  const totalRepos = repos.length;
  const totalOpenPrs = 0;
  const avgHealthScore = 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SignedOut>
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to view your repositories.
            </h1>
            <p className="max-w-md text-sm text-slate-600">
              Connect GitHub via Clerk to let .flux analyze your codebase and
              meeting history in one place.
            </p>
            <SignInButton mode="modal">
              <Button className="h-10 rounded-full bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-md shadow-blue-500/30 hover:bg-[#1d4ed8]">
                Sign In with GitHub
              </Button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="space-y-8">
            {/* Header */}
            <section className="space-y-2">
              <p className="text-sm font-medium text-slate-500">Dashboard</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Good to see you,{" "}
                <span className="text-[#2563eb]">
                  {user?.firstName ?? user?.username ?? "Engineer"}
                </span>
                .
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                Here&apos;s a snapshot of the repositories you&apos;ve synced
                with .flux and how they&apos;re performing.
              </p>
            </section>

            {/* Stats row */}
            <section className="grid gap-4 md:grid-cols-3">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-slate-700">
                      Connected repos
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Total repositories connected to .flux.
                    </CardDescription>
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-[#2563eb]">
                    <GitBranch className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-slate-900">
                    {totalRepos}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-slate-700">
                      Open PRs
                    </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Coming soon: live PR stats from GitHub.
                      </CardDescription>
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-[#2563eb]">
                    <GitPullRequest className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-slate-900">
                    {totalOpenPrs}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-medium text-slate-700">
                      Avg. health score
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Coming soon: health scores from AI analysis.
                    </CardDescription>
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-[#2563eb]">
                    <Activity className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-slate-900">
                    {avgHealthScore}
                    <span className="ml-1 text-sm text-slate-500">/ 100</span>
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Repositories table + side panel */}
            <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Repositories
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Repos you&apos;ve connected to .flux for analysis.
                    </CardDescription>
                  </div>
                  <Button className="h-9 rounded-full bg-[#2563eb] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8]">
                    Add repository
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  <AddRepoForm />

                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      <span>Repository</span>
                      <span>Branch · Owner</span>
                      <span>Open PRs</span>
                      <span>Last analysis</span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white text-sm">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {repos.map((repo: any) => (
                        <div
                          key={repo._id}
                          className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-4 py-3 hover:bg-slate-50/80"
                        >
                          <div className="space-y-0.5">
                            <p className="font-medium text-slate-900">
                              {repo.repoName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {repo.repoOwner}
                            </p>
                          </div>
                          <div className="text-[12px] text-slate-600">
                            <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                              {repo.defaultBranch}
                            </span>
                            <span>{repo.repoOwner}</span>
                          </div>
                          <div className="text-[12px] text-slate-700">
                            —
                          </div>
                          <div className="text-[12px] text-slate-600">
                            {new Date(repo.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Next steps
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Make the most of .flux by keeping your repos and meetings in
                    sync.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                    <div className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-blue-50 text-[#2563eb]">
                      <Star className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Run a fresh repo analysis
                      </p>
                      <p className="text-xs text-slate-600">
                        Kick off a new full-repo audit to refresh your health
                        scores and highlight technical debt.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-900">
                      Tip: connect your meetings
                    </p>
                    <p className="mt-1">
                      Invite the .flux bot to your next architecture sync so PR
                      reviews and audio summaries stay aligned.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}


