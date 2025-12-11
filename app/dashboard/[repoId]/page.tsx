"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RepoVoiceChat } from "@/components/repo/repo-voice-chat";
import {
  Activity,
  ArrowLeft,
  GitBranch,
  GitPullRequest,
  History,
  Users,
  PhoneCall,
} from "lucide-react";

export default function RepoDashboardPage() {
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId as Id<"repos">;

  const router = useRouter();
  const deleteRepo = useMutation(api.app.deleteRepoAndData);

  const repo = useQuery(
    api.app.getRepo,
    repoId ? { repoId } : ("skip" as any)
  );
  const techStack = useQuery(
    api.app.listTechStackItemsForRepo,
    repoId ? { repoId } : ("skip" as any)
  );
  const history = useQuery(
    api.app.listHistoryCheckpointsForRepo,
    repoId ? { repoId } : ("skip" as any)
  );
  const pullRequests = useQuery(
    api.app.listPullRequestsForRepo,
    repoId ? { repoId } : ("skip" as any)
  );
  const prAnalyses = useQuery(
    api.app.listPrAnalysesForRepo,
    repoId ? { repoId } : ("skip" as any)
  );
  const contributorsDetailed = useQuery(
    api.app.listRepoContributorsDetailed,
    repoId ? { repoId } : ("skip" as any)
  );
  const analysisSessions = useQuery(
    api.app.listAnalysisSessionsForRepo,
    repoId ? { repoId } : ("skip" as any)
  );
  const calls = useQuery(
    api.app.listCallsForRepo,
    repoId ? { repoId } : ("skip" as any)
  );

  if (!repo) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to dashboard
          </Link>
          <p className="mt-6 text-sm text-slate-600">Loading repository…</p>
        </main>
      </div>
    );
  }

  const techItems = techStack ?? [];
  const historyItems = history ?? [];
  const prs = pullRequests ?? [];
  const analyses = prAnalyses ?? [];
  const contributors = contributorsDetailed ?? [];
  const sessions = analysisSessions ?? [];
  const callSessions = calls ?? [];

  function getPrAnalysisStatus(prId: Id<"pullRequests">) {
    const related = analyses.filter((a) => a.pullRequestId === prId);
    if (related.length === 0) return "Pending";
    const latest = related.reduce((acc, cur) =>
      (cur.updatedAt ?? cur.createdAt) > (acc.updatedAt ?? acc.createdAt)
        ? cur
        : acc
    );
    if (latest.status === "completed") return "Analyzed";
    if (latest.status === "running") return "Running…";
    if (latest.status === "failed") return "Failed";
    return "Pending";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Link>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Repository dashboard
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {repo.repoOwner}/{repo.repoName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="rounded-full bg-[#2563eb] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
            >
              <Link href={repo.url} target="_blank" rel="noreferrer">
                Open on GitHub
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
              type="button"
              onClick={async () => {
                const confirmed = window.confirm(
                  "Delete this repository and all its synced data from .flux? This cannot be undone."
                );
                if (!confirmed) return;
                await deleteRepo({ repoId });
                router.push("/dashboard");
              }}
            >
              Delete & reset
            </Button>
          </div>
        </div>

        {/* Top grid: General info + Contributors */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* General Info & History */}
          <Card className="lg:col-span-2 border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    General info
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Overview of this repository and recent history.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <GitBranch className="h-4 w-4 text-[#2563eb]" />
                  <span>{repo.defaultBranch}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900">
                  {repo.repoName}
                </h2>
                {repo.description && (
                  <p className="text-sm text-slate-600">{repo.description}</p>
                )}
              </div>

              {techItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tech stack
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {techItems.map((item) => (
                      <span
                        key={item._id}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                      >
                        {item.name}
                        {item.version && (
                          <span className="ml-1 text-slate-500">
                            {item.version}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <History className="h-3.5 w-3.5 text-[#2563eb]" />
                  <span>History</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {historyItems.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No history checkpoints yet. They&apos;ll appear here as
                      analyses and calls run.
                    </p>
                  )}
                  {historyItems.map((checkpoint) => (
                    <div
                      key={checkpoint._id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <p className="text-xs font-semibold text-slate-900">
                        {checkpoint.title}
                      </p>
                      {checkpoint.description && (
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          {checkpoint.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[11px] text-slate-500">
                          {new Date(checkpoint.eventAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contributors */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Contributors
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Key contributors and their activity.
                </CardDescription>
              </div>
              <Users className="h-4 w-4 text-[#2563eb]" />
            </CardHeader>
            <CardContent className="space-y-2">
              {contributors.length === 0 && (
                <p className="text-xs text-slate-500">
                  No contributors detected yet.
                </p>
              )}
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {contributors.map((item: any) => {
                  const c = item.contributor;
                  const link = item.repoContributor;
                  return (
                    <div
                      key={link._id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                          {c.login?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900">
                            {c.login}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {link.role ?? "Contributor"} ·{" "}
                            {link.seniority ?? "Unspecified"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-medium text-slate-900">
                          {link.prCount} PRs
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {link.linesChanged} lines changed
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Middle grid: PR List + Call log / Analysis */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* PR List and Analyses (left, spans 2 columns) */}
          <div className="space-y-6 lg:col-span-2">
            {/* PR List */}
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Pull requests
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Recent PRs and their analysis status.
                  </CardDescription>
                </div>
                <GitPullRequest className="h-4 w-4 text-[#2563eb]" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] border-b border-slate-100 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  <span>PR</span>
                  <span>Title</span>
                  <span>Status</span>
                  <span>Author</span>
                  <span>Analysis</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {prs.length === 0 && (
                    <p className="py-3 text-xs text-slate-500">
                      No pull requests synced yet.
                    </p>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {prs.map((pr: any) => (
                    <div
                      key={pr._id}
                      className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center py-2 text-[12px]"
                    >
                      <span className="font-medium text-slate-900">
                        #{pr.prNumber}
                      </span>
                      <span className="truncate text-slate-800">
                        {pr.title}
                      </span>
                      <span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            pr.status === "open"
                              ? "bg-emerald-50 text-emerald-700"
                              : pr.status === "merged"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {pr.status}
                        </span>
                      </span>
                      <span className="text-slate-600">—</span>
                      <span className="text-slate-700">
                        {getPrAnalysisStatus(pr._id)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Analysis sessions */}
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Analyses
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Snapshot and PR analyses over time.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-7 rounded-full bg-[#2563eb] px-3 text-[11px] font-semibold text-white hover:bg-[#1d4ed8]"
                  type="button"
                  onClick={() => {
                    // Placeholder for future analysis workflow
                    // eslint-disable-next-line no-alert
                    alert("Analysis triggering coming soon.");
                  }}
                >
                  Run analysis
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessions.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No analyses have been run for this repo yet.
                  </p>
                )}
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {sessions.map((session: any) => (
                    <div
                      key={session._id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-900">
                          {session.sessionType === "pr_auto"
                            ? "PR analysis"
                            : session.sessionType === "manual_snapshot"
                              ? "Manual snapshot"
                              : session.sessionType === "full_repo"
                                ? "Full repo analysis"
                                : "Analysis"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {session.summary ??
                            new Date(session.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right text-[11px]">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                            session.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : session.status === "running"
                                ? "bg-amber-50 text-amber-700"
                                : session.status === "failed"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {session.status}
                        </span>
                        {session.startedAt && (
                          <p className="mt-1 text-slate-500">
                            {new Date(session.startedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Call log (right column) */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Call log
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Recorded sessions and their summaries.
                </CardDescription>
              </div>
              <PhoneCall className="h-4 w-4 text-[#2563eb]" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Idle</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 rounded-full bg-[#2563eb] px-3 text-[11px] font-semibold text-white hover:bg-[#1d4ed8]"
                    type="button"
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      alert("Call recording not implemented yet.");
                    }}
                  >
                    Start call
                  </Button>
                </div>
              </div>

              {callSessions.length === 0 && (
                <p className="text-xs text-slate-500">
                  No calls recorded for this repo yet.
                </p>
              )}

              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {callSessions.map((call: any) => (
                  <div
                    key={call._id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-900">
                        {new Date(call.startTime).toLocaleString()}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          call.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : call.status === "running"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {call.status}
                      </span>
                    </div>
                    {call.shortSummary && (
                      <p className="mt-1 text-[11px] text-slate-600">
                        {call.shortSummary}
                      </p>
                    )}
                    {call.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {call.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Voice chatbot section */}
        <section>
          <RepoVoiceChat repoId={repoId} />
        </section>
      </main>
    </div>
  );
}
