"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { useMemo, useState, useRef } from "react";
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
  const runFullAnalysis = useAction(api.prAgent.runFullAnalysisWorkflow);
  const startCallSession = useAction(api.calls.startCallSession);
  const finishCallSession = useAction(api.calls.finishCallSession);

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

  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [activeCallId, setActiveCallId] = useState<Id<"calls"> | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<Id<"calls"> | null>(
    null
  );

  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callChunksRef = useRef<Blob[]>([]);

  const latestAnalysisByPrId = useMemo(() => {
    const map = new Map<string, any>();
    (prAnalyses ?? []).forEach((a: any) => {
      const key = a.pullRequestId;
      const current = map.get(key);
      if (
        !current ||
        (a.updatedAt ?? a.createdAt) > (current.updatedAt ?? current.createdAt)
      ) {
        map.set(key, a);
      }
    });
    return map;
  }, [prAnalyses]);
  const techItems = techStack ?? [];
  const historyItems = history ?? [];
  const prs = pullRequests ?? [];
  const analyses = prAnalyses ?? [];
  const contributors = contributorsDetailed ?? [];
  const sessions = analysisSessions ?? [];
  const callSessions = calls ?? [];

  // Map latest call-analysis session per call id.
  const callAnalysisByCallId = useMemo(() => {
    const map = new Map<string, any>();
    (sessions ?? []).forEach((s: any) => {
      const cfg = (s.config as any) ?? {};
      if (s.sessionType === "call" && cfg.kind === "call" && cfg.callId) {
        const key = String(cfg.callId);
        const current = map.get(key);
        if (
          !current ||
          (s.updatedAt ?? s.createdAt) > (current.updatedAt ?? current.createdAt)
        ) {
          map.set(key, s);
        }
      }
    });
    return map;
  }, [sessions]);

  const selectedCallActionItems = useQuery(
    api.app.listCallActionItems,
    selectedCallId ? { callId: selectedCallId } : ("skip" as any)
  );

  const latestSnapshotSession = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotSessions = (sessions as any[]).filter((s: any) => {
      const kind = (s.config as any)?.kind;
      return s.sessionType === "full_repo" && kind === "repo_snapshot";
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshotSessions.sort((a: any, b: any) => {
      const at = a.updatedAt ?? a.createdAt;
      const bt = b.updatedAt ?? b.createdAt;
      return bt - at;
    });
    return snapshotSessions[0] ?? null;
  }, [sessions]);

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

  async function handleCallButtonClick() {
    if (isCallRecording) {
      const recorder = callRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      setIsCallRecording(false);
      return;
    }

    try {
      setCallError(null);
      const { callId } = await startCallSession({ repoId });
      setActiveCallId(callId as Id<"calls">);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setCallError("Unable to start a new call session.");
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream);
        callRecorderRef.current = recorder;
        callChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            callChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(callChunksRef.current, { type: "audio/webm" });
          void transcribeAndFinishCall(blob);
        };

        recorder.start();
        setIsCallRecording(true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        setCallError(
          "Unable to access microphone. Check browser permissions and try again."
        );
      });
  }

  async function transcribeAndFinishCall(blob: Blob) {
    if (!activeCallId) return;

    try {
      const formData = new FormData();
      formData.set("audio", blob);

      const listenRes = await fetch("/api/listen", {
        method: "POST",
        body: formData,
      });

      if (!listenRes.ok) {
        throw new Error("Failed to transcribe call audio.");
      }

      const listenData = (await listenRes.json()) as { text?: string };
      const transcript = listenData.text?.trim();

      if (!transcript) {
        throw new Error("Transcription did not return any text.");
      }

      await finishCallSession({
        repoId,
        callId: activeCallId,
        transcript,
      });

      setActiveCallId(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong processing this call.";
      setCallError(message);
    }
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

              {latestSnapshotSession && (
                <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Latest repo snapshot
                  </p>
                  {latestSnapshotSession.summary && (
                    <p className="text-xs text-slate-700">
                      {latestSnapshotSession.summary}
                    </p>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {((latestSnapshotSession.config as any)?.snapshot
                    ?.suggestedNextSteps ?? []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Suggested next steps
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(latestSnapshotSession.config as any).snapshot.suggestedNextSteps.map(
                          (step: string) => (
                            <li key={step}>{step}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

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
                          {Array.isArray(link.mainAreas) &&
                            link.mainAreas.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {link.mainAreas.map((area: string) => (
                                  <span
                                    key={area}
                                    className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                  >
                                    {area}
                                  </span>
                                ))}
                              </div>
                            )}
                          {link.profileSummary && (
                            <p className="mt-1 text-[11px] text-slate-600">
                              {link.profileSummary}
                            </p>
                          )}
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
                  {prs.map((pr: any) => {
                    const statusLabel = getPrAnalysisStatus(pr._id);
                    const hasCompletedAnalysis =
                      latestAnalysisByPrId.get(pr._id)?.status === "completed";
                    return (
                      <button
                        key={pr._id}
                        type="button"
                        disabled={!hasCompletedAnalysis}
                        onClick={() =>
                          hasCompletedAnalysis && setSelectedPrId(pr._id)
                        }
                        className="grid w-full grid-cols-[minmax(0,1.2fr)_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center py-2 text-left text-[12px] hover:bg-slate-50/80 disabled:cursor-default disabled:bg-transparent"
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
                          {statusLabel}
                        </span>
                      </button>
                    );
                  })}
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
                  onClick={async () => {
                    await runFullAnalysis({ repoId });
                    // eslint-disable-next-line no-alert
                    alert(
                      "Full analysis started. Refresh this page in a bit to see updated insights.",
                    );
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
                                : session.sessionType === "call"
                                  ? "Call analysis"
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
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      isCallRecording ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <span>{isCallRecording ? "Recording…" : "Idle"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-7 rounded-full bg-[#2563eb] px-3 text-[11px] font-semibold text-white hover:bg-[#1d4ed8]"
                    type="button"
                    onClick={() => {
                      void handleCallButtonClick();
                    }}
                  >
                    {isCallRecording ? "Stop & analyze" : "Start call"}
                  </Button>
                </div>
              </div>

              {callError && (
                <p className="text-[11px] font-medium text-rose-600">{callError}</p>
              )}

              {callSessions.length === 0 && (
                <p className="text-xs text-slate-500">
                  No calls recorded for this repo yet.
                </p>
              )}

              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {callSessions.map((call: any) => {
                  const analysis = callAnalysisByCallId.get(String(call._id));
                  const isAnalyzed = analysis?.status === "completed";
                  const analysisLabel = !analysis
                    ? "Not analyzed"
                    : analysis.status === "completed"
                      ? "Analyzed"
                      : "Analyzing…";
                  return (
                  <button
                    key={call._id}
                    type="button"
                    onClick={() => {
                      if (isAnalyzed) {
                        setSelectedCallId(call._id);
                      }
                    }}
                    className="w-full text-left disabled:cursor-default disabled:opacity-60"
                    disabled={!isAnalyzed}
                  >
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
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
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {analysisLabel}
                      </p>
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
                  </button>
                );})}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Voice chatbot section */}
        <section>
          <RepoVoiceChat repoId={repoId} />
        </section>
      </main>
      {selectedPrId && latestAnalysisByPrId.get(selectedPrId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pr = prs.find((p: any) => p._id === selectedPrId);
              const analysis = latestAnalysisByPrId.get(selectedPrId);
              if (!pr || !analysis) return null;

              return (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        PR analysis
                      </p>
                      <h2 className="text-sm font-semibold text-slate-900">
                        #{pr.prNumber} · {pr.title}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.riskLevel && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            analysis.riskLevel === "low"
                              ? "bg-emerald-50 text-emerald-700"
                              : analysis.riskLevel === "medium"
                                ? "bg-amber-50 text-amber-700"
                                : analysis.riskLevel === "high"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {analysis.riskLevel} risk
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full px-3 text-[11px]"
                        type="button"
                        onClick={() => setSelectedPrId(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-700">
                    {analysis.summary && (
                      <div>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Summary
                        </p>
                        <p className="whitespace-pre-line text-xs">
                          {analysis.summary}
                        </p>
                      </div>
                    )}

                    {Array.isArray(analysis.filesChanged) &&
                      analysis.filesChanged.length > 0 && (
                        <div>
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Files changed
                          </p>
                          <ul className="list-disc space-y-0.5 pl-4">
                            {analysis.filesChanged.map((f: string) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {Array.isArray(analysis.impactedPaths) &&
                      analysis.impactedPaths.length > 0 && (
                        <div>
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Impacted areas
                          </p>
                          <ul className="list-disc space-y-0.5 pl-4">
                            {analysis.impactedPaths.map((p: string) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {selectedCallId && (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const call = callSessions.find((c: any) => c._id === selectedCallId);
        if (!call) return null;
        const items = selectedCallActionItems ?? [];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Call details
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {new Date(call.startTime).toLocaleString()}
                  </h2>
                  {call.durationSeconds && (
                    <p className="text-[11px] text-slate-500">
                      Duration: {Math.round(call.durationSeconds / 60)} min
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-full px-3 text-[11px]"
                    type="button"
                    onClick={() => setSelectedCallId(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                {call.shortSummary && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Summary
                    </p>
                    <p className="whitespace-pre-line text-xs">
                      {call.shortSummary}
                    </p>
                  </div>
                )}

                {call.tags?.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {call.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {items.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Action items
                    </p>
                    <ul className="space-y-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {items.map((item: any) => (
                        <li
                          key={item._id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-1.5"
                        >
                          <div className="flex-1">
                            <p className="text-xs text-slate-800">
                              {item.description}
                            </p>
                            {item.filePath && (
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {item.filePath}
                              </p>
                            )}
                          </div>
                          <span
                            className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              item.status === "open"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {item.status === "open" ? "Open" : "Done"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
