import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { createThread, listUIMessages } from "@convex-dev/agent";
import { api, components } from "./_generated/api";
import { prAnalyzerAgent } from "./agents/PRAnalyzer";
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
        // Use the repo owner as the Agent "userId" to satisfy context requirements
        // and override tools with none; we just want pure analysis.
        { userId: repo.ownerUserId.id ?? String(repo.ownerUserId), tools: {} },
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

