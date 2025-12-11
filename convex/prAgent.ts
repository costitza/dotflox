import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { createThread, listUIMessages } from "@convex-dev/agent";
import { api, components } from "./_generated/api";
import { prAnalyzerAgent } from "./agents/PRAnalyzer";
import { contributorProfilerAgent } from "./agents/ContributorProfiler";
import { repoSnapshotAgent } from "./agents/RepoSnapshotAgent";
import { historySynthesisAgent } from "./agents/HistorySynthesizer";
import { syncPullRequestArgs, type SyncPullRequestArgs } from "./github";

/**
 * Create a new thread for the PR Analyzer agent.
 *
 * Use this from the frontend to start a new "conversation" about PRs.
 */
export const createPrAnalyzerThread = mutation({
  args: {
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    // If you have an application-level user id (e.g. Clerk user id),
    // you can thread it through here as a string.
    userId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { title, summary, userId }
  ): Promise<{ threadId: string }> => {
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: title ?? "PR Analyzer",
      summary: summary ?? undefined,
    });
    return { threadId };
  },
});

/**
 * List UI-friendly messages for a given PR Analyzer thread.
 *
 * This is designed to be used with `useUIMessages` on the frontend,
 * and supports streaming as described in the Convex Agent docs.
 */
export const listPrAnalyzerThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, args);
    return paginated;
  },
});

/**
 * Action: Run the PR Analyzer Agent on a GitHub pull request.
 *
 * This represents a "workflow" step. It:
 * - Ensures there is a thread (creating one if needed)
 * - Instructs the agent to sync the PR into Convex using its tools
 * - Returns the threadId and the assistant text
 */
export const runPrAnalyzerWorkflow = action({
  args: {
    threadId: v.optional(v.string()),
    // Raw GitHub API payloads (trim or shape these as desired in your app).
    repo: v.any(),
    pullRequest: v.any(),
  },
  handler: async (
    ctx,
    { threadId, repo, pullRequest }
  ): Promise<{ threadId: string; text: string }> => {
    const syncedAt = Date.now();

    // Map GitHub payloads into the shape expected by the Agent tool
    // and the underlying Convex mutation.
    const toolArgs: SyncPullRequestArgs = {
      repo: {
        githubRepoId: String(repo.id),
        owner: repo.owner?.login ?? repo.owner ?? "unknown-owner",
        name: repo.name,
        description: repo.description ?? undefined,
        url: repo.html_url,
        defaultBranch: repo.default_branch ?? "main",
      },
      author: {
        githubUserId: String(pullRequest.user?.id ?? pullRequest.user_id),
        login: pullRequest.user?.login ?? pullRequest.user_login ?? "unknown-user",
        name: pullRequest.user?.name ?? undefined,
        avatarUrl: pullRequest.user?.avatar_url ?? undefined,
      },
      pullRequest: {
        githubPrId: String(pullRequest.id),
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body ?? undefined,
        state: pullRequest.state === "open" ? "open" : "closed",
        merged: Boolean(pullRequest.merged_at),
        createdAt: new Date(pullRequest.created_at).getTime(),
        mergedAt: pullRequest.merged_at
          ? new Date(pullRequest.merged_at).getTime()
          : undefined,
        closedAt: pullRequest.closed_at
          ? new Date(pullRequest.closed_at).getTime()
          : undefined,
      },
      stats: {
        additions: pullRequest.additions ?? 0,
        deletions: pullRequest.deletions ?? 0,
        changedFiles: pullRequest.changed_files ?? 0,
      },
      syncedAt,
    };

    let effectiveThreadId = threadId;
    if (!effectiveThreadId) {
      effectiveThreadId = await createThread(ctx, components.agent, {
        title: `PR #${toolArgs.pullRequest.number} - ${toolArgs.pullRequest.title}`,
        summary: "GitHub PR analysis thread",
      });
    }

    const prompt = [
      "You are the PR Analyzer Agent.",
      "You are given structured GitHub pull request data.",
      "Call the `syncGithubPullRequest` tool exactly once with the provided JSON arguments to sync this PR into Convex.",
      "Do not invent or modify fields; use them as-is.",
      "Here are the arguments in JSON:",
      JSON.stringify(toolArgs),
    ].join("\n\n");

    const result = await prAnalyzerAgent.generateText(
      ctx,
      { threadId: effectiveThreadId },
      { prompt }
    );

    return { threadId: effectiveThreadId, text: result.text };
  },
});

/**
 * Simple test action for the PR Analyzer Agent.
 *
 * Call this from the Convex dashboard or tests by passing in
 * normalized `SyncPullRequestArgs`. It will:
 * - Create a fresh thread
 * - Ask the agent to sync the PR via its tool
 * - Return the text response and thread id
 *
 * NOTE: For the underlying sync to succeed, there must already be
 * a `repos` row whose `githubRepoId` matches `args.repo.githubRepoId`.
 */
export const testPrAnalyzerAgent = action({
  args: syncPullRequestArgs,
  handler: async (
    ctx,
    args: SyncPullRequestArgs
  ): Promise<{ threadId: string; text: string }> => {
    const threadId = await createThread(ctx, components.agent, {
      title: `Test PR #${args.pullRequest.number}`,
      summary: "Test thread for PR Analyzer Agent",
    });

    const prompt = [
      "You are the PR Analyzer Agent under test.",
      "Call the `syncGithubPullRequest` tool exactly once using the JSON arguments below.",
      "Respond briefly confirming what you synced.",
      JSON.stringify(args),
    ].join("\n\n");

    const result = await prAnalyzerAgent.generateText(
      ctx,
      { threadId },
      { prompt }
    );

    return { threadId, text: result.text };
  },
});

// Repo-level analysis workflow:
// - Creates an analysis session for the repo
// - Finds PRs that need (re-)analysis
// - For each, runs the PR Analyzer Agent and stores results in prAnalyses
export const runRepoAnalysisWorkflow = action({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    const repo = await ctx.runQuery(api.app.getRepo, { repoId });
    if (!repo) return;

    // Avoid overlapping analysis sessions for the same repo.
    const existingSessions = await ctx.runQuery(
      api.app.listAnalysisSessionsForRepo,
      { repoId }
    );
    const hasRunning = existingSessions.some(
      (s) => s.status === "running"
    );
    if (hasRunning) return;

    const prs = await ctx.runQuery(api.app.listPullRequestsForRepo, {
      repoId,
    });
    const analyses = await ctx.runQuery(api.app.listPrAnalysesForRepo, {
      repoId,
    });

    // Map latest analysis per PR
    const latestByPrId = new Map<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analyses.forEach((a: any) => {
      const key = a.pullRequestId;
      const current = latestByPrId.get(key);
      if (
        !current ||
        (a.updatedAt ?? a.createdAt) > (current.updatedAt ?? current.createdAt)
      ) {
        latestByPrId.set(key, a);
      }
    });

    // PRs needing analysis: no analysis yet, or not completed, or older than lastSyncedAt.
    const candidates = prs.filter((pr: any) => {
      const analysis = latestByPrId.get(pr._id);
      if (!analysis) return true;
      if (analysis.status !== "completed") return true;
      if ((analysis.updatedAt ?? analysis.createdAt) < pr.lastSyncedAt) {
        return true;
      }
      return false;
    });

    if (candidates.length === 0) {
      return;
    }

    const sessionId = await ctx.runMutation(api.app.createAnalysisSession, {
      repoId,
      userId: repo.ownerUserId,
      sessionType: "pr_auto",
      status: "running",
      config: undefined,
      summary: `Automatic PR analysis for ${repo.repoName}`,
    });

    // Limit to a reasonable number per run for hackathon performance.
    const toAnalyze = candidates.slice(0, 10);

    for (const pr of toAnalyze) {
      const prAnalysisId = await ctx.runMutation(api.app.createPrAnalysis, {
        repoId,
        pullRequestId: pr._id,
        status: "running",
        summary: undefined,
        filesChanged: undefined,
        impactedPaths: undefined,
        riskLevel: undefined,
        rawMetadata: undefined,
      });

      await ctx.runMutation(api.app.addAnalysisSessionPR, {
        analysisSessionId: sessionId,
        pullRequestId: pr._id,
        status: "running",
      });

      const prompt = [
        "You are an expert GitHub pull request analysis agent.",
        "You will be given structured data for a single PR from a codebase.",
        "Respond with a concise JSON object describing the analysis.",
        "",
        "Input shape:",
        "{",
        '  "title": string,',
        '  "body": string | null,',
        '  "repoName": string,',
        '  "repoOwner": string',
        "}",
        "",
        "Output JSON shape (no extra keys):",
        "{",
        '  "summary": string,',
        '  "riskLevel": "low" | "medium" | "high" | "critical",',
        '  "filesChanged": string[],',
        '  "impactedPaths": string[]',
        "}",
        "",
        "Here is the PR JSON:",
        JSON.stringify({
          title: pr.title,
          body: pr.body ?? null,
          repoName: repo.repoName,
          repoOwner: repo.repoOwner,
        }),
      ].join("\n");

      const result = await prAnalyzerAgent.generateText(
        ctx,
        // Use the repo owner as the Agent \"userId\" to satisfy context requirements.
        { userId: String(repo.ownerUserId) },
        { prompt }
      );

      let parsed:
        | {
            summary: string;
            riskLevel: "low" | "medium" | "high" | "critical";
            filesChanged: string[];
            impactedPaths: string[];
          }
        | null = null;

      try {
        parsed = JSON.parse(result.text);
      } catch {
        parsed = null;
      }

      await ctx.runMutation(api.app.updatePrAnalysisDetails, {
        prAnalysisId,
        status: "completed",
        summary: parsed?.summary ?? result.text,
        filesChanged: parsed?.filesChanged ?? [],
        impactedPaths: parsed?.impactedPaths ?? [],
        riskLevel: parsed?.riskLevel ?? "medium",
        rawMetadata: parsed,
      });
    }

    await ctx.runMutation(api.app.updateAnalysisSessionStatus, {
      analysisSessionId: sessionId,
      status: "completed",
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
  },
});

/**
 * ContributorProfileRefreshWorkflow
 *
 * For a single repo, iterate over all repoContributors and invoke the
 * Contributor Profiler agent once per contributor. The agent receives a
 * JSON summary of their PRs and impacted paths, and calls the
 * `saveRepoContributorProfile` tool to persist role/seniority/areas.
 */
export const runContributorProfileRefreshWorkflow = action({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    const repo = await ctx.runQuery(api.app.getRepo, { repoId });
    if (!repo) return;

    const [linksDetailed, pullRequests, prAnalyses] = await Promise.all([
      ctx.runQuery(api.app.listRepoContributorsDetailed, { repoId }),
      ctx.runQuery(api.app.listPullRequestsForRepo, { repoId }),
      ctx.runQuery(api.app.listPrAnalysesForRepo, { repoId }),
    ]);

    // Build latest analysis per PR id for quick lookup.
    const latestAnalysisByPrId = new Map<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prAnalyses as any[]).forEach((a: any) => {
      const key = a.pullRequestId;
      const current = latestAnalysisByPrId.get(key);
      if (
        !current ||
        (a.updatedAt ?? a.createdAt) > (current.updatedAt ?? current.createdAt)
      ) {
        latestAnalysisByPrId.set(key, a);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of linksDetailed as any[]) {
      const contributor = item.contributor;
      const link = item.repoContributor;
      if (!contributor || !link) continue;

      // PRs authored by this contributor in this repo.
      const authoredPrs = (pullRequests as any[]).filter(
        (pr: any) => pr.authorContributorId === contributor._id
      );

      const prSummaries = authoredPrs.map((pr: any) => {
        const analysis = latestAnalysisByPrId.get(pr._id);
        return {
          prNumber: pr.prNumber,
          title: pr.title,
          status: pr.status,
          createdAt: pr.createdAt,
          mergedAt: pr.mergedAt ?? null,
          filesChanged: analysis?.filesChanged ?? [],
          impactedPaths: analysis?.impactedPaths ?? [],
          riskLevel: analysis?.riskLevel ?? null,
        };
      });

      const allPaths = new Set<string>();
      prSummaries.forEach((pr) => {
        (pr.impactedPaths ?? []).forEach((p: string) => allPaths.add(p));
      });

      const contributionSummary = {
        repo: {
          repoId: String(repoId),
          owner: repo.repoOwner,
          name: repo.repoName,
        },
        contributor: {
          contributorId: String(contributor._id),
          login: contributor.login,
          name: contributor.name ?? null,
        },
        aggregateStats: {
          prCount: prSummaries.length,
          linesChanged: link.linesChanged,
          pathsTouched: Array.from(allPaths),
        },
        pullRequests: prSummaries,
      };

      const prompt = [
        "You are the Contributor Profiler agent.",
        "You will be given JSON describing a single contributor's behavior in this repository.",
        "Your job is to infer their primary role, seniority, main areas of ownership, and a short profile summary.",
        "",
        "CRITICAL: When you are ready, call the `saveRepoContributorProfile` tool EXACTLY ONCE",
        "using the provided `repoId` and `contributorId` fields from the JSON below.",
        "Do not invent ids; use them as-is.",
        "",
        "Here is the input JSON:",
        JSON.stringify(contributionSummary),
      ].join("\n\n");

      await contributorProfilerAgent.generateText(
        ctx,
        {
          // Use repo owner as a stable \"user\" identity for this agent family.
          userId: String(repo.ownerUserId),
        },
        { prompt }
      );
    }
  },
});

/**
 * ManualAnalysisSessionWorkflow (Repo snapshot focus)
 *
 * Creates an analysis session of type \"full_repo\", gathers repo-level
 * context (tech stack, recent PR analyses, history), and asks the
 * Repo Snapshot agent to persist a structured snapshot via its tool.
 */
export const runRepoSnapshotWorkflow = action({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    const repo = await ctx.runQuery(api.app.getRepo, { repoId });
    if (!repo) return;

    const [techStack, prAnalyses, history] = await Promise.all([
      ctx.runQuery(api.app.listTechStackItemsForRepo, { repoId }),
      ctx.runQuery(api.app.listPrAnalysesForRepo, { repoId }),
      ctx.runQuery(api.app.listHistoryCheckpointsForRepo, { repoId }),
    ]);

    const sessionId = await ctx.runMutation(api.app.createAnalysisSession, {
      repoId,
      userId: repo.ownerUserId,
      sessionType: "full_repo",
      status: "running",
      config: { kind: "repo_snapshot" },
      summary: `Repo snapshot for ${repo.repoOwner}/${repo.repoName}`,
    });

    // Take the most recent N PR analyses to keep context size bounded.
    const recentAnalyses = [...(prAnalyses ?? [])]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => {
        const at = a.updatedAt ?? a.createdAt;
        const bt = b.updatedAt ?? b.createdAt;
        return bt - at;
      })
      .slice(0, 25);

    const snapshotInput = {
      analysisSessionId: String(sessionId),
      repoId: String(repoId),
      repo: {
        owner: repo.repoOwner,
        name: repo.repoName,
        description: repo.description ?? null,
        defaultBranch: repo.defaultBranch,
        url: repo.url,
      },
      techStack: techStack ?? [],
      recentPrAnalyses: recentAnalyses,
      historyCheckpoints: history ?? [],
    };

    const prompt = [
      "You are the Repo Snapshot agent.",
      "You are given JSON describing a repository and its recent activity.",
      "Use it to understand the tech stack, main modules, risky/high-churn areas, and suggested next steps.",
      "",
      "IMPORTANT: When you are ready, call the `saveRepoSnapshotResult` tool EXACTLY ONCE.",
      "Use the `analysisSessionId` and `repoId` from the JSON as-is.",
      "",
      "Here is the input JSON:",
      JSON.stringify(snapshotInput),
    ].join("\n\n");

    await repoSnapshotAgent.generateText(
      ctx,
      {
        userId: String(repo.ownerUserId),
      },
      { prompt }
    );

    await ctx.runMutation(api.app.updateAnalysisSessionStatus, {
      analysisSessionId: sessionId,
      status: "completed",
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
  },
});

/**
 * NightlyHistorySynthesisWorkflow (can also be triggered manually)
 *
 * Gathers recent raw events for a repo (PR analyses, analysis sessions,
 * calls, existing checkpoints) and asks the History Synthesis agent to
 * compress them into a small set of high-level history checkpoints.
 */
export const runHistorySynthesisWorkflow = action({
  args: {
    repoId: v.id("repos"),
    // Optional window in days; defaults to 30.
    windowDays: v.optional(v.number()),
  },
  handler: async (ctx, { repoId, windowDays }) => {
    const days = windowDays ?? 30;
    const now = Date.now();
    const windowStart = now - days * 24 * 60 * 60 * 1000;

    const [prAnalyses, analysisSessions, calls, history] = await Promise.all([
      ctx.runQuery(api.app.listPrAnalysesForRepo, { repoId }),
      ctx.runQuery(api.app.listAnalysisSessionsForRepo, { repoId }),
      ctx.runQuery(api.app.listCallsForRepo, { repoId }),
      ctx.runQuery(api.app.listHistoryCheckpointsForRepo, { repoId }),
    ]);

    // Filter events to the requested time window where we have timestamps.
    const inWindow = <T extends { createdAt?: number; eventAt?: number }>(
      items: T[]
    ) =>
      items.filter((i) => {
        const t = (i as any).eventAt ?? (i as any).createdAt;
        return typeof t === "number" && t >= windowStart;
      });

    const synthesisInput = {
      repoId: String(repoId),
      windowStart,
      windowEnd: now,
      prAnalyses: inWindow(prAnalyses ?? []),
      analysisSessions: inWindow(analysisSessions ?? []),
      calls: inWindow(calls ?? []),
      historyCheckpoints: inWindow(history ?? []),
    };

    const prompt = [
      "You are the History Synthesis agent.",
      "You are given JSON with recent raw events for a repository.",
      "Pick 3–10 of the most important milestones that summarize this window.",
      "",
      "CRITICAL: When you are ready, call the `saveHistoryCheckpoints` tool EXACTLY ONCE",
      "with your synthesized checkpoints. Use the provided repoId as-is.",
      "",
      "Here is the input JSON:",
      JSON.stringify(synthesisInput),
    ].join("\n\n");

    await historySynthesisAgent.generateText(
      ctx,
      { userId: String(repoId) },
      { prompt }
    );
  },
});

/**
 * High-level convenience action that kicks off all major analysis
 * workflows for a repo:
 * - Repo snapshot (general info / tech stack / roadmap)
 * - PR auto-analysis (per-PR summaries and risk levels)
 * - Contributor profile refresh (roles, seniority, areas)
 * - History synthesis (high-level checkpoints)
 *
 * This is what the frontend \"Run analysis\" button should call.
 */
export const runFullAnalysisWorkflow = action({
  args: { repoId: v.id("repos") },
  handler: async (ctx, { repoId }) => {
    // Run the sub-workflows asynchronously via the scheduler so that
    // this action returns quickly and we avoid long-running timeouts.
    await ctx.scheduler.runAfter(0, api.prAgent.runRepoSnapshotWorkflow, {
      repoId,
    });
    await ctx.scheduler.runAfter(0, api.prAgent.runRepoAnalysisWorkflow, {
      repoId,
    });
    await ctx.scheduler.runAfter(
      0,
      api.prAgent.runContributorProfileRefreshWorkflow,
      { repoId }
    );
    await ctx.scheduler.runAfter(
      0,
      api.prAgent.runHistorySynthesisWorkflow,
      {
        repoId,
        windowDays: 30,
      }
    );
  },
});

